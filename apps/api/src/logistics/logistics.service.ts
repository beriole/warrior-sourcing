import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  INSPECTION_RESULT_LABELS,
  SHIPMENT_STAGE_LABELS,
  SHIPMENT_STAGES,
  type BulkAdvanceData,
  type BulkAdvanceResponse,
  type CreateInspectionData,
  type InspectionReportResponse,
  type OpsBoardQueryData,
  type OpsBoardResponse,
  type ParcelResponse,
  type RecordShipmentEventData,
  type ShipmentEventResponse,
  type ShipmentStage,
  type TrackedOrderDetailResponse,
  type TrackedOrderListResponse,
  type TrackedOrderSummary,
  type UserRole,
} from '@ws/contracts';
import type { SessionUser } from '../auth/auth.guard.js';
import type { Env } from '../config/env.js';
import type {
  InspectionReport,
  Parcel,
  Prisma,
  ShipmentEvent,
} from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Rôles autorisés à enregistrer un événement logistique (LOG-01). */
export const LOGISTICS_ROLES: UserRole[] = [
  'LOGISTICS_AGENT',
  'CHINA_AGENT',
  'ADMIN',
  'SUPER_ADMIN',
];

/** Seuls les administrateurs peuvent ramener une commande à une étape antérieure. */
const ROLLBACK_ROLES: UserRole[] = ['ADMIN', 'SUPER_ADMIN'];

/** Alphabet sans caractères ambigus (pas de 0/O ni de 1/I) pour un code lisible au téléphone. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function stageIndex(stage: ShipmentStage): number {
  return SHIPMENT_STAGES.indexOf(stage);
}

function nextStageOf(stage: ShipmentStage): ShipmentStage | null {
  return SHIPMENT_STAGES[stageIndex(stage) + 1] ?? null;
}

/** Sélection commune des commandes suivies : ce que la liste, le détail et le tableau affichent. */
const orderSummarySelect = {
  id: true,
  reference: true,
  stage: true,
  shippingMode: true,
  totalXaf: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { name: true, email: true } },
  events: {
    orderBy: { occurredAt: 'desc' as const },
    take: 1,
    select: { description: true, occurredAt: true },
  },
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSummarySelect }>;

/**
 * Logistique, suivi et inspection (lot LOG).
 *
 * Règle centrale : Order.stage n'avance que par un événement réel enregistré par un agent (§25).
 * Aucune position n'est inventée ; un retour en arrière est une exception motivée, réservée aux
 * administrateurs, et reste visible dans l'historique.
 */
@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ───────────────────────── Lecture ─────────────────────────

  /** Commandes de l'utilisateur connecté, les plus récentes d'abord (LOG-02). */
  async listOwnOrders(userId: string): Promise<TrackedOrderListResponse> {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: orderSummarySelect,
    });
    const extras = await this.loadExtras(rows.map((row) => row.id));
    return { orders: rows.map((row) => this.toSummary(row, extras)) };
  }

  /**
   * Détail d'une commande. Un client ne voit que les siennes : une commande d'autrui
   * répond « introuvable », pour ne rien révéler de son existence.
   */
  async getOrder(reference: string, actor: SessionUser): Promise<TrackedOrderDetailResponse> {
    const order = await this.prisma.order.findUnique({
      where: { reference },
      select: orderSummarySelect,
    });
    if (!order || (!LOGISTICS_ROLES.includes(actor.role) && order.userId !== actor.id)) {
      throw new NotFoundException('Cette commande est introuvable.');
    }

    const [parcel, events, inspections] = await Promise.all([
      this.ensureParcel(order.id),
      this.prisma.shipmentEvent.findMany({
        where: { orderId: order.id },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.inspectionReport.findMany({
        where: { orderId: order.id },
        orderBy: { inspectedAt: 'desc' },
      }),
    ]);

    const extras = {
      parcels: new Map([[order.id, parcel]]),
      inspections: new Map(inspections[0] ? [[order.id, inspections[0].result]] : []),
    };

    return {
      order: this.toSummary(order, extras),
      parcel: this.toParcel(parcel),
      events: events.map((event) => this.toEvent(event)),
      inspections: inspections.map((report) => this.toInspection(report)),
      stages: SHIPMENT_STAGES.map((stage) => ({ stage, label: SHIPMENT_STAGE_LABELS[stage] })),
    };
  }

  /** Vue opérationnelle : une colonne par étape, filtrable (LOG-04). */
  async board(query: OpsBoardQueryData): Promise<OpsBoardResponse> {
    const where: Prisma.OrderWhereInput = {};
    if (query.stage) where.stage = query.stage;
    else if (query.livrees === 'non') where.stage = { not: 'DELIVERED' };
    if (query.mode) where.shippingMode = query.mode;

    if (query.recherche) {
      const term = query.recherche;
      // Un code de colis se cherche tel quel : on retrouve d'abord les commandes qui le portent.
      const parcels = await this.prisma.parcel.findMany({
        where: { code: { contains: term, mode: 'insensitive' } },
        select: { orderId: true },
      });
      where.OR = [
        { reference: { contains: term, mode: 'insensitive' } },
        { user: { name: { contains: term, mode: 'insensitive' } } },
        ...(parcels.length > 0 ? [{ id: { in: parcels.map((parcel) => parcel.orderId) } }] : []),
      ];
    }

    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { updatedAt: 'asc' },
      select: orderSummarySelect,
    });
    await this.ensureParcels(rows.map((row) => row.id));
    const extras = await this.loadExtras(rows.map((row) => row.id));

    const columns = SHIPMENT_STAGES.map((stage) => ({
      stage,
      label: SHIPMENT_STAGE_LABELS[stage],
      orders: rows
        .filter((row) => row.stage === stage)
        .map((row) => ({
          ...this.toSummary(row, extras),
          customerName: row.user.name || row.user.email,
        })),
    }));

    return { columns, total: rows.length };
  }

  // ───────────────────────── Écriture ─────────────────────────

  /**
   * Enregistre un événement et fait avancer la commande (LOG-01).
   * Même étape : l'événement s'ajoute à l'historique sans changer l'étape, donc sans notification.
   * Étape antérieure : refusée, sauf administrateur avec motif.
   */
  async recordEvent(
    reference: string,
    input: RecordShipmentEventData,
    actor: SessionUser,
  ): Promise<ShipmentEventResponse> {
    const order = await this.findOrderOrFail(reference);
    const event = await this.applyEvent(order, input, actor);
    return this.toEvent(event);
  }

  /** Fait passer chaque commande sélectionnée à son étape suivante (LOG-04). */
  async bulkAdvance(input: BulkAdvanceData, actor: SessionUser): Promise<BulkAdvanceResponse> {
    const orders = await this.prisma.order.findMany({
      where: { id: { in: input.orderIds } },
      select: orderSummarySelect,
    });
    const byId = new Map(orders.map((order) => [order.id, order]));

    const result: BulkAdvanceResponse = { advanced: [], skipped: [] };
    for (const orderId of input.orderIds) {
      const order = byId.get(orderId);
      if (!order) {
        result.skipped.push({ orderId, reason: 'Commande introuvable.' });
        continue;
      }
      const next = nextStageOf(order.stage);
      if (!next) {
        result.skipped.push({ orderId, reason: 'Commande déjà livrée.' });
        continue;
      }
      await this.applyEvent(
        order,
        {
          stage: next,
          occurredAt: input.occurredAt ?? new Date(),
          description: input.description,
          proofUrl: input.proofUrl,
          proofUrls: [],
        },
        actor,
      );
      result.advanced.push({ orderId, reference: order.reference, stage: next });
    }
    return result;
  }

  /**
   * Rapport d'inspection (LOG-05). Le rapport est archivé tel quel, un événement « Inspection »
   * le rattache à l'historique et le client en est informé par email.
   */
  async createInspection(
    reference: string,
    input: CreateInspectionData,
    actor: SessionUser,
  ): Promise<InspectionReportResponse> {
    const order = await this.findOrderOrFail(reference);
    const inspectionIndex = stageIndex('INSPECTION');
    if (stageIndex(order.stage) > inspectionIndex) {
      throw new ConflictException(
        'La marchandise a déjà quitté l’entrepôt : une inspection n’est plus possible.',
      );
    }

    const inspectedAt = input.inspectedAt ?? new Date();
    const resultLabel = INSPECTION_RESULT_LABELS[input.result];
    const details = [
      input.quantityReceived !== undefined && input.quantityExpected !== undefined
        ? `${input.quantityReceived} reçu(s) sur ${input.quantityExpected} attendu(s)`
        : null,
      input.defects ? `défauts : ${input.defects}` : null,
    ].filter((part): part is string => part !== null);
    const description = `Inspection réalisée — résultat : ${resultLabel}${details.length > 0 ? ` (${details.join(' ; ')})` : ''}.`;

    const report = await this.prisma.inspectionReport.create({
      data: {
        orderId: order.id,
        result: input.result,
        quantityExpected: input.quantityExpected,
        quantityReceived: input.quantityReceived,
        defects: input.defects,
        packaging: input.packaging,
        measurements: input.measurements,
        weightGrams: input.weightGrams,
        photoUrls: input.photoUrls,
        videoUrl: input.videoUrl,
        notes: input.notes,
        inspectedAt,
        inspectedById: actor.id,
        inspectedByName: displayName(actor),
      },
    });

    await this.applyEvent(
      order,
      {
        stage: 'INSPECTION',
        occurredAt: inspectedAt,
        description,
        proofUrl: input.photoUrls[0],
        proofUrls: [...input.photoUrls.slice(1), ...(input.videoUrl ? [input.videoUrl] : [])],
      },
      actor,
      { inspectionId: report.id, notifyEvenIfUnchanged: true },
    );

    return this.toInspection(report);
  }

  // ───────────────────────── Interne ─────────────────────────

  private async findOrderOrFail(reference: string): Promise<OrderRow> {
    const order = await this.prisma.order.findUnique({
      where: { reference },
      select: orderSummarySelect,
    });
    if (!order) throw new NotFoundException('Cette commande est introuvable.');
    return order;
  }

  /**
   * Cœur de la transition d'état. La notification part en arrière-plan, une seule fois,
   * et uniquement quand l'étape change réellement (LOG-03).
   */
  private async applyEvent(
    order: OrderRow,
    input: RecordShipmentEventData,
    actor: SessionUser,
    options: { inspectionId?: string; notifyEvenIfUnchanged?: boolean } = {},
  ): Promise<ShipmentEvent> {
    const from = stageIndex(order.stage);
    const to = stageIndex(input.stage);
    const isRollback = to < from;

    if (isRollback) {
      if (!ROLLBACK_ROLES.includes(actor.role)) {
        throw new ForbiddenException(
          'Seul un administrateur peut ramener une commande à une étape antérieure.',
        );
      }
      if (!input.rollbackReason) {
        throw new BadRequestException({
          message: 'Un retour en arrière exige un motif.',
          code: 'rollback_reason_required',
          issues: [{ path: 'rollbackReason', message: 'Expliquez le motif du retour en arrière.' }],
        });
      }
    }

    const stageChanged = to !== from;
    const parcel = await this.ensureParcel(order.id);

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shipmentEvent.create({
        data: {
          orderId: order.id,
          stage: input.stage,
          occurredAt: input.occurredAt,
          description: input.description,
          proofUrl: input.proofUrl,
          proofUrls: input.proofUrls,
          recordedById: actor.id,
          recordedByName: displayName(actor),
          rollbackReason: isRollback ? input.rollbackReason : null,
          previousStage: order.stage,
          inspectionId: options.inspectionId,
        },
      });
      if (stageChanged) {
        await tx.order.update({ where: { id: order.id }, data: { stage: input.stage } });
      }
      return created;
    });

    if (stageChanged || options.notifyEvenIfUnchanged) {
      this.notify(order, event, parcel);
    }
    // La commande passée en paramètre reflète désormais la nouvelle étape (utile aux boucles groupées).
    order.stage = input.stage;

    return event;
  }

  /** Email « shipment-update », jamais bloquant : un échec se journalise, la saisie reste acquise. */
  private notify(order: OrderRow, event: ShipmentEvent, parcel: Parcel): void {
    const appUrl = this.config.get('APP_URL', { infer: true });
    void this.mail
      .send({
        to: order.user.email,
        template: 'shipment-update',
        userId: order.userId,
        data: {
          firstName: order.user.name,
          orderReference: order.reference,
          stage: event.stage,
          eventDescription: event.description,
          eventAt: event.occurredAt.toISOString(),
          trackingCode: parcel.code,
          trackingUrl: `${appUrl}/importations/${encodeURIComponent(order.reference)}`,
        },
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        this.logger.warn(`Notification de suivi non envoyée pour ${order.reference} : ${message}`);
      });
  }

  /** Attribue un code unique à la commande si elle n'en a pas encore (idempotent). */
  private async ensureParcel(orderId: string): Promise<Parcel> {
    const existing = await this.prisma.parcel.findUnique({ where: { orderId } });
    if (existing) return existing;

    // Collision improbable (32^8 codes) mais possible : on retire.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.parcel.create({ data: { orderId, code: generateParcelCode() } });
      } catch (error) {
        const again = await this.prisma.parcel.findUnique({ where: { orderId } });
        if (again) return again;
        if (attempt === 4) throw error;
      }
    }
    throw new Error('Impossible d’attribuer un code de colis.');
  }

  private async ensureParcels(orderIds: string[]): Promise<void> {
    if (orderIds.length === 0) return;
    const existing = await this.prisma.parcel.findMany({
      where: { orderId: { in: orderIds } },
      select: { orderId: true },
    });
    const known = new Set(existing.map((parcel) => parcel.orderId));
    for (const orderId of orderIds) {
      if (!known.has(orderId)) await this.ensureParcel(orderId);
    }
  }

  /** Colis et dernier résultat d'inspection, pour enrichir des résumés en deux requêtes. */
  private async loadExtras(orderIds: string[]) {
    if (orderIds.length === 0) {
      return {
        parcels: new Map<string, Parcel>(),
        inspections: new Map<string, InspectionReport['result']>(),
      };
    }
    const [parcels, reports] = await Promise.all([
      this.prisma.parcel.findMany({ where: { orderId: { in: orderIds } } }),
      this.prisma.inspectionReport.findMany({
        where: { orderId: { in: orderIds } },
        orderBy: { inspectedAt: 'desc' },
        select: { orderId: true, result: true },
      }),
    ]);
    const inspections = new Map<string, InspectionReport['result']>();
    for (const report of reports) {
      // Trié du plus récent au plus ancien : la première occurrence est la bonne.
      if (!inspections.has(report.orderId)) inspections.set(report.orderId, report.result);
    }
    return { parcels: new Map(parcels.map((parcel) => [parcel.orderId, parcel])), inspections };
  }

  private toSummary(
    row: OrderRow,
    extras: { parcels: Map<string, Parcel>; inspections: Map<string, InspectionReport['result']> },
  ): TrackedOrderSummary {
    const index = stageIndex(row.stage);
    const next = nextStageOf(row.stage);
    return {
      id: row.id,
      reference: row.reference,
      stage: row.stage,
      stageLabel: SHIPMENT_STAGE_LABELS[row.stage],
      stageIndex: index,
      stageCount: SHIPMENT_STAGES.length,
      nextStage: next,
      nextStageLabel: next ? SHIPMENT_STAGE_LABELS[next] : null,
      progress: (index + 1) / SHIPMENT_STAGES.length,
      shippingMode: row.shippingMode,
      totalXaf: row.totalXaf,
      parcelCode: extras.parcels.get(row.id)?.code ?? null,
      lastEvent: row.events[0]
        ? {
            description: row.events[0].description,
            occurredAt: row.events[0].occurredAt.toISOString(),
          }
        : null,
      lastInspectionResult: extras.inspections.get(row.id) ?? null,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toEvent(event: ShipmentEvent): ShipmentEventResponse {
    return {
      id: event.id,
      stage: event.stage,
      stageLabel: SHIPMENT_STAGE_LABELS[event.stage],
      occurredAt: event.occurredAt.toISOString(),
      description: event.description,
      proofUrl: event.proofUrl,
      proofUrls: event.proofUrls,
      recordedByName: event.recordedByName,
      rollbackReason: event.rollbackReason,
      previousStage: event.previousStage,
      inspectionId: event.inspectionId,
      createdAt: event.createdAt.toISOString(),
    };
  }

  private toParcel(parcel: Parcel | null): ParcelResponse | null {
    return parcel ? { id: parcel.id, code: parcel.code, label: parcel.label } : null;
  }

  private toInspection(report: InspectionReport): InspectionReportResponse {
    return {
      id: report.id,
      result: report.result,
      resultLabel: INSPECTION_RESULT_LABELS[report.result],
      quantityExpected: report.quantityExpected,
      quantityReceived: report.quantityReceived,
      defects: report.defects,
      packaging: report.packaging,
      measurements: report.measurements,
      weightGrams: report.weightGrams,
      photoUrls: report.photoUrls,
      videoUrl: report.videoUrl,
      notes: report.notes,
      inspectedAt: report.inspectedAt.toISOString(),
      inspectedByName: report.inspectedByName,
      createdAt: report.createdAt.toISOString(),
    };
  }
}

/** Un compte créé par code email n'a pas encore de nom : on retombe sur l'adresse. */
function displayName(actor: SessionUser): string {
  return actor.name?.trim() || actor.email;
}

/** Code lisible du type WS-7K3M-Q2ZP. */
export function generateParcelCode(): string {
  const pick = () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  const block = () => Array.from({ length: 4 }, pick).join('');
  return `WS-${block()}-${block()}`;
}
