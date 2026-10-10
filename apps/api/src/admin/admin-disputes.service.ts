import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DISPUTE_STATUSES,
  DISPUTE_STATUS_LABELS,
  DISPUTE_TRANSITIONS,
  canTransitionDispute,
  type AdvanceDisputeRequest,
  type CreateDisputeRequest,
  type DisputeDetailResponse,
  type DisputeListResponse,
  type DisputeResponse,
  type DisputeSearchQuery,
  type DisputeStatus,
} from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';

type LigneLitige = {
  id: string;
  reference: string;
  orderId: string;
  customerId: string;
  category: DisputeResponse['category'];
  status: DisputeStatus;
  subject: string;
  description: string;
  claimedAmountXaf: number;
  resolvedAmountXaf: number | null;
  openedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
};

/**
 * Litiges (ADM-08, §39).
 *
 * Le workflow est strictement séquentiel : ouverture, analyse, preuves, contact fournisseur,
 * proposition, résolution, clôture. Aucun raccourci n'est accepté par le serveur, et chaque
 * franchissement d'étape laisse une trace dans le journal du litige et dans `AuditLog`.
 */
@Injectable()
export class AdminDisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Référence lisible, unique : LIT-AAAAMMJJ-XXXX. */
  private async nouvelleReference(): Promise<string> {
    const jour = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    for (let essai = 0; essai < 10; essai += 1) {
      const suffixe = Math.floor(1_000 + Math.random() * 9_000).toString();
      const reference = `LIT-${jour}-${suffixe}`;
      const existe = await this.prisma.dispute.findUnique({ where: { reference }, select: { id: true } });
      if (!existe) return reference;
    }
    throw new BadRequestException('Impossible de générer une référence de litige. Réessayez.');
  }

  /** Complète les litiges avec la commande et le client, absents du modèle (pas de relation croisée). */
  private async format(rows: LigneLitige[]): Promise<DisputeResponse[]> {
    if (rows.length === 0) return [];

    const [commandes, clients] = await Promise.all([
      this.prisma.order.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.orderId))] } },
        select: { id: true, reference: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.customerId))] } },
        select: { id: true, name: true, email: true },
      }),
    ]);
    const referenceParCommande = new Map(commandes.map((item) => [item.id, item.reference]));
    const clientParId = new Map(clients.map((item) => [item.id, item]));

    return rows.map((row) => {
      const client = clientParId.get(row.customerId);
      return {
        id: row.id,
        reference: row.reference,
        orderId: row.orderId,
        orderReference: referenceParCommande.get(row.orderId) ?? '',
        customerName: client?.name ?? '',
        customerEmail: client?.email ?? '',
        category: row.category,
        status: row.status,
        subject: row.subject,
        description: row.description,
        claimedAmountXaf: row.claimedAmountXaf,
        resolvedAmountXaf: row.resolvedAmountXaf,
        openedById: row.openedById,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      };
    });
  }

  async list(query: DisputeSearchQuery): Promise<DisputeListResponse> {
    const where = {
      ...(query.statut ? { status: query.statut } : {}),
      ...(query.recherche
        ? {
            OR: [
              { reference: { contains: query.recherche, mode: 'insensitive' as const } },
              { subject: { contains: query.recherche, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total, parEtat] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.taille,
        take: query.taille,
      }),
      this.prisma.dispute.count({ where }),
      this.prisma.dispute.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    return {
      disputes: await this.format(rows),
      total,
      page: query.page,
      taille: query.taille,
      // Une étape sans dossier vaut zéro : la file d'attente reste lisible de bout en bout.
      byStatus: DISPUTE_STATUSES.map((status) => ({
        status,
        count: parEtat.find((ligne) => ligne.status === status)?._count._all ?? 0,
      })),
    };
  }

  async detail(id: string): Promise<DisputeDetailResponse> {
    const litige = await this.prisma.dispute.findUnique({ where: { id } });
    if (!litige) throw new NotFoundException("Ce litige n'existe pas.");

    const evenements = await this.prisma.disputeEvent.findMany({
      where: { disputeId: id },
      orderBy: { createdAt: 'asc' },
    });

    const auteurIds = [
      ...new Set(evenements.map((event) => event.actorId).filter((value): value is string => Boolean(value))),
    ];
    const auteurs = auteurIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: auteurIds } }, select: { id: true, name: true } })
      : [];
    const nomParId = new Map(auteurs.map((auteur) => [auteur.id, auteur.name]));

    const [dispute] = await this.format([litige]);

    return {
      dispute,
      events: evenements.map((event) => ({
        id: event.id,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        evidenceUrl: event.evidenceUrl,
        actorId: event.actorId,
        actorName: event.actorId ? (nomParId.get(event.actorId) ?? null) : null,
        createdAt: event.createdAt.toISOString(),
      })),
      allowedStatuses: [...DISPUTE_TRANSITIONS[litige.status]],
    };
  }

  /** Ouverture d'un dossier : premier état, première ligne de journal. */
  async create(
    input: CreateDisputeRequest,
    actorId: string,
    ipAddress: string | null,
  ): Promise<DisputeDetailResponse> {
    const commande = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, reference: true, userId: true },
    });
    if (!commande) throw new NotFoundException("Cette commande n'existe pas.");

    const reference = await this.nouvelleReference();

    const litige = await this.prisma.dispute.create({
      data: {
        reference,
        orderId: commande.id,
        customerId: commande.userId,
        category: input.category,
        subject: input.subject,
        description: input.description,
        claimedAmountXaf: input.claimedAmountXaf ?? 0,
        openedById: actorId,
        status: 'OPENED',
        events: {
          create: {
            fromStatus: null,
            toStatus: 'OPENED',
            note: input.description,
            actorId,
          },
        },
      },
      select: { id: true },
    });

    await this.audit.record({
      actorId,
      action: 'dispute.opened',
      entity: 'dispute',
      entityId: litige.id,
      metadata: { reference, orderReference: commande.reference, category: input.category },
      ipAddress,
    });

    return this.detail(litige.id);
  }

  /**
   * Passage à l'étape suivante. Une transition non prévue est refusée : aucun dossier ne
   * saute la collecte de preuves ni le contact du fournisseur pour arriver à la résolution.
   */
  async advance(
    id: string,
    input: AdvanceDisputeRequest,
    actorId: string,
    ipAddress: string | null,
  ): Promise<DisputeDetailResponse> {
    const litige = await this.prisma.dispute.findUnique({
      where: { id },
      select: { id: true, reference: true, status: true },
    });
    if (!litige) throw new NotFoundException("Ce litige n'existe pas.");

    if (!canTransitionDispute(litige.status, input.status)) {
      const possibles = DISPUTE_TRANSITIONS[litige.status];
      throw new BadRequestException(
        possibles.length
          ? `Depuis l'étape « ${DISPUTE_STATUS_LABELS[litige.status]} », la seule étape possible est « ${
              DISPUTE_STATUS_LABELS[possibles[0]]
            } ».`
          : `Ce litige est clôturé : il ne change plus d'étape.`,
      );
    }

    await this.prisma.dispute.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.resolvedAmountXaf !== undefined ? { resolvedAmountXaf: input.resolvedAmountXaf } : {}),
        ...(input.status === 'CLOSED' ? { closedAt: new Date() } : {}),
        events: {
          create: {
            fromStatus: litige.status,
            toStatus: input.status,
            note: input.note,
            evidenceUrl: input.evidenceUrl ?? null,
            actorId,
          },
        },
      },
    });

    await this.audit.record({
      actorId,
      action: 'dispute.status.changed',
      entity: 'dispute',
      entityId: id,
      metadata: {
        reference: litige.reference,
        from: litige.status,
        to: input.status,
        note: input.note,
        ...(input.evidenceUrl ? { evidenceUrl: input.evidenceUrl } : {}),
        ...(input.resolvedAmountXaf !== undefined ? { resolvedAmountXaf: input.resolvedAmountXaf } : {}),
      },
      ipAddress,
    });

    return this.detail(id);
  }
}
