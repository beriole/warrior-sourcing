import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  SERVICE_ORDER_STATUS_LABELS,
  SERVICE_PRICING_MODE_LABELS,
  canTransitionServiceOrder,
  formatLeadTime,
  isServiceOrderable,
  serviceNotOrderableReason,
  serviceOrderProgressPercent,
  type AddServiceDeliverableRequest,
  type AdvanceServiceOrderRequest,
  type CreateServiceOrderRequest,
  type CreateServiceOrderResponse,
  type RetryServiceOrderPaymentRequest,
  type ServiceCard,
  type ServiceCatalogQuery,
  type ServiceCatalogResponse,
  type ServiceCategory,
  type ServiceDetailResponse,
  type ServiceOrderDetail,
  type ServiceOrderListResponse,
  type ServiceOrderQuery,
  type ServiceOrderResponse,
  type ServiceOrderStatus,
  type ServiceOrderSummary,
  type ServicePricingMode,
} from '@ws/contracts';
import type { SessionUser } from '../auth/auth.guard.js';
import { PaymentsService, randomCode } from '../payments/payments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Référence lisible d'une commande de prestation : SRV-XXXXXXXX. */
export function serviceOrderReference(): string {
  return `SRV-${randomCode(8)}`;
}

type LignePrestation = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: ServiceCategory;
  pricingMode: ServicePricingMode;
  priceXaf: number | null;
  leadTimeDays: number | null;
  leadTimeNote: string | null;
  deliverables: string[];
  conditions: string[];
  requirements: string[];
  publishedAt: Date | null;
};

type LigneCommande = {
  id: string;
  reference: string;
  userId: string;
  status: ServiceOrderStatus;
  amountXaf: number;
  leadTimeDays: number | null;
  orderedDeliverables: string[];
  brief: string;
  city: string;
  contactPhone: string;
  quantity: number | null;
  budgetXaf: number | null;
  links: string[];
  createdAt: Date;
  paidAt: Date | null;
  deliveredAt: Date | null;
  service: { slug: string; name: string; category: ServiceCategory };
  events: {
    id: string;
    toStatus: ServiceOrderStatus;
    note: string | null;
    createdAt: Date;
  }[];
  deliverables: {
    id: string;
    title: string;
    fileFormat: string;
    sizeBytes: number | null;
    url: string;
    note: string | null;
    createdAt: Date;
  }[];
  _count?: { deliverables: number };
};

/**
 * Prestations et commandes de prestation (lot SRV, §29).
 *
 * Trois règles portent ce service :
 *
 * 1. **Le montant vient du catalogue, jamais du client.** La requête de commande ne
 *    transporte aucun prix : le serveur lit celui de la prestation et le fige sur la
 *    commande. Ce qui a été annoncé au moment de l'achat reste opposable même si la
 *    fiche change ensuite.
 * 2. **Une prestation sur devis ne se paie pas en ligne.** Le contrat le dit, le serveur
 *    le vérifie : on ne facture pas un montant qu'on n'a pas publié.
 * 3. **Le client ne fait pas avancer sa propre commande.** L'exécution est écrite par
 *    l'équipe ; le client lit un suivi, il ne le rédige pas.
 */
@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  // ───────────────────────── Catalogue (SRV-01) ─────────────────────────

  private carte(row: LignePrestation): ServiceCard {
    const orderable = isServiceOrderable(row);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      summary: row.summary,
      category: row.category,
      categoryLabel: SERVICE_CATEGORY_LABELS[row.category].label,
      pricingMode: row.pricingMode,
      pricingModeLabel: SERVICE_PRICING_MODE_LABELS[row.pricingMode],
      priceXaf: row.priceXaf,
      leadTimeDays: row.leadTimeDays,
      leadTimeLabel: formatLeadTime(row.leadTimeDays),
      orderable,
      notOrderableReason: orderable ? null : serviceNotOrderableReason(row),
      // Une prestation non publiée n'est jamais servie : la date existe toujours ici.
      publishedAt: (row.publishedAt ?? new Date()).toISOString(),
    };
  }

  async catalog(query: ServiceCatalogQuery): Promise<ServiceCatalogResponse> {
    const where = {
      publishedAt: { not: null },
      ...(query.category ? { category: query.category } : {}),
      ...(query.maxPriceXaf ? { priceXaf: { lte: query.maxPriceXaf } } : {}),
      // « Commandable » dépend du mode de tarification et d'un prix présent : on filtre
      // sur les deux conditions, pour ne pas promettre un filtre que la base ne tient pas.
      ...(query.orderableOnly ? { pricingMode: { not: 'QUOTE' as const }, priceXaf: { not: null } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { summary: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total, groupes] = await Promise.all([
      this.prisma.serviceOffering.findMany({
        where,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.serviceOffering.count({ where }),
      this.prisma.serviceOffering.groupBy({
        by: ['category'],
        where: { publishedAt: { not: null } },
        _count: { _all: true },
      }),
    ]);

    // L'ordre des catégories suit le parcours d'une importation, pas le hasard du groupBy.
    const compte = new Map(groupes.map((groupe) => [groupe.category as ServiceCategory, groupe._count._all]));

    return {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      items: rows.map((row) => this.carte(row as unknown as LignePrestation)),
      categories: SERVICE_CATEGORIES.filter((category) => compte.has(category)).map((category) => ({
        category,
        label: SERVICE_CATEGORY_LABELS[category].label,
        count: compte.get(category) ?? 0,
      })),
    };
  }

  async detail(slug: string): Promise<ServiceDetailResponse> {
    const row = await this.prisma.serviceOffering.findFirst({
      where: { slug, publishedAt: { not: null } },
    });
    if (!row) throw new NotFoundException('Cette prestation n’existe pas.');

    const ligne = row as unknown as LignePrestation;
    return {
      service: {
        ...this.carte(ligne),
        description: ligne.description,
        deliverables: ligne.deliverables,
        conditions: ligne.conditions,
        requirements: ligne.requirements,
        leadTimeNote: ligne.leadTimeNote,
      },
    };
  }

  // ───────────────────────── Commandes (SRV-02) ─────────────────────────

  private resume(row: LigneCommande): ServiceOrderSummary {
    return {
      reference: row.reference,
      status: row.status,
      statusLabel: SERVICE_ORDER_STATUS_LABELS[row.status].label,
      statusDescription: SERVICE_ORDER_STATUS_LABELS[row.status].description,
      progressPercent: serviceOrderProgressPercent(row.status),
      serviceSlug: row.service.slug,
      serviceName: row.service.name,
      category: row.service.category,
      categoryLabel: SERVICE_CATEGORY_LABELS[row.service.category].label,
      amountXaf: row.amountXaf,
      leadTimeDays: row.leadTimeDays,
      leadTimeLabel: formatLeadTime(row.leadTimeDays),
      deliverableCount: row._count?.deliverables ?? row.deliverables.length,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
    };
  }

  private async detailCommande(row: LigneCommande): Promise<ServiceOrderDetail> {
    const paiement = await this.payments.latestForServiceOrder(row.id);
    // Les livrables ne sont servis qu'une fois la commande payée : avant, il n'y a rien
    // à remettre, et un fichier visible avant paiement serait une porte ouverte.
    const payee = row.paidAt !== null;

    return {
      ...this.resume(row),
      brief: row.brief,
      city: row.city,
      contactPhone: row.contactPhone,
      quantity: row.quantity,
      budgetXaf: row.budgetXaf,
      links: row.links,
      orderedDeliverables: row.orderedDeliverables,
      events: row.events.map((event) => ({
        id: event.id,
        status: event.toStatus,
        statusLabel: SERVICE_ORDER_STATUS_LABELS[event.toStatus].label,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
      })),
      deliverables: payee
        ? row.deliverables.map((livrable) => ({
            id: livrable.id,
            title: livrable.title,
            fileFormat: livrable.fileFormat,
            sizeBytes: livrable.sizeBytes,
            url: livrable.url,
            note: livrable.note,
            createdAt: livrable.createdAt.toISOString(),
          }))
        : [],
      payment: paiement ? this.payments.toSummary(paiement) : null,
    };
  }

  private static readonly INCLUSION = {
    service: { select: { slug: true, name: true, category: true } },
    events: { orderBy: { createdAt: 'asc' as const } },
    deliverables: { orderBy: { createdAt: 'asc' as const } },
  } as const;

  async create(user: SessionUser, input: CreateServiceOrderRequest): Promise<CreateServiceOrderResponse> {
    const prestation = await this.prisma.serviceOffering.findFirst({
      where: { slug: input.serviceSlug, publishedAt: { not: null } },
    });
    if (!prestation) throw new NotFoundException('Cette prestation n’existe pas.');

    const ligne = prestation as unknown as LignePrestation;
    const refus = serviceNotOrderableReason(ligne);
    if (refus !== null || ligne.priceXaf === null) {
      throw new ConflictException({ message: refus ?? 'Cette prestation n’est pas payable en ligne.', code: 'service_not_orderable' });
    }

    const commande = await this.prisma.serviceOrder.create({
      data: {
        reference: serviceOrderReference(),
        userId: user.id,
        serviceId: ligne.id,
        // Montant, délai et livrables sont figés ici : c'est l'engagement du jour.
        amountXaf: ligne.priceXaf,
        leadTimeDays: ligne.leadTimeDays,
        orderedDeliverables: ligne.deliverables,
        brief: input.brief,
        city: input.city,
        contactPhone: input.contactPhone,
        quantity: input.quantity ?? null,
        budgetXaf: input.budgetXaf ?? null,
        links: input.links,
        events: {
          create: {
            fromStatus: null,
            toStatus: 'PENDING_PAYMENT',
            source: 'commande',
            note: 'Demande enregistrée. Elle démarre dès que le paiement est confirmé.',
          },
        },
      },
      include: ServicesService.INCLUSION,
    });

    const paiement = await this.payments.initiateForOrder({
      serviceOrderId: commande.id,
      user,
      amountXaf: commande.amountXaf,
      method: input.paymentMethod,
      payerPhone: input.payerPhone ?? input.contactPhone,
      message: `Prestation ${commande.reference} — ${ligne.name}`,
    });

    await this.prisma.serviceOrder.update({
      where: { id: commande.id },
      data: { paymentReference: paiement.reference },
    });

    return {
      order: await this.detailCommande(commande as unknown as LigneCommande),
      payment: paiement,
    };
  }

  async list(userId: string, query: ServiceOrderQuery): Promise<ServiceOrderListResponse> {
    const where = { userId, ...(query.status ? { status: query.status } : {}) };

    const [rows, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        include: {
          service: { select: { slug: true, name: true, category: true } },
          events: { orderBy: { createdAt: 'asc' as const } },
          deliverables: { orderBy: { createdAt: 'asc' as const } },
          _count: { select: { deliverables: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    return {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      items: rows.map((row) => this.resume(row as unknown as LigneCommande)),
    };
  }

  /** Une commande n'est lisible que par son auteur ou par l'équipe. */
  private async trouver(reference: string, user: SessionUser): Promise<LigneCommande> {
    const row = await this.prisma.serviceOrder.findUnique({
      where: { reference },
      include: ServicesService.INCLUSION,
    });
    if (!row) throw new NotFoundException('Cette commande de prestation n’existe pas.');

    const equipe = user.role !== 'CLIENT' && user.role !== 'PREMIUM_MEMBER';
    if (row.userId !== user.id && !equipe) {
      // Même message que pour une référence inconnue : on ne révèle pas qu'elle existe.
      throw new NotFoundException('Cette commande de prestation n’existe pas.');
    }
    return row as unknown as LigneCommande;
  }

  async findOne(reference: string, user: SessionUser): Promise<ServiceOrderResponse> {
    return { order: await this.detailCommande(await this.trouver(reference, user)) };
  }

  /** Relance d'un paiement sur une commande restée impayée. */
  async retryPayment(
    reference: string,
    user: SessionUser,
    input: RetryServiceOrderPaymentRequest,
  ): Promise<CreateServiceOrderResponse> {
    const commande = await this.trouver(reference, user);
    if (commande.userId !== user.id) {
      throw new ForbiddenException('Seul le client peut relancer le paiement de sa prestation.');
    }
    if (commande.status !== 'PENDING_PAYMENT') {
      throw new ConflictException({
        message: 'Cette commande n’attend plus de paiement.',
        code: 'service_order_not_payable',
      });
    }

    const dernier = await this.payments.latestForServiceOrder(commande.id);
    if (dernier && (dernier.status === 'INITIATED' || dernier.status === 'PENDING')) {
      const resume = this.payments.toSummary(dernier);
      throw new ConflictException({
        message: `Une demande de paiement est déjà en cours (${resume.reference}). Validez-la ou attendez son expiration.`,
        code: 'payment_in_progress',
      });
    }

    const paiement = await this.payments.initiateForOrder({
      serviceOrderId: commande.id,
      user,
      amountXaf: commande.amountXaf,
      method: input.paymentMethod,
      payerPhone: input.payerPhone ?? commande.contactPhone,
      message: `Prestation ${commande.reference}`,
    });

    await this.prisma.serviceOrder.update({
      where: { id: commande.id },
      data: { paymentReference: paiement.reference },
    });

    return { order: await this.detailCommande(commande), payment: paiement };
  }

  /** Annulation par le client, tant que rien n'a été payé. */
  async cancel(reference: string, user: SessionUser): Promise<ServiceOrderResponse> {
    const commande = await this.trouver(reference, user);
    if (commande.userId !== user.id) {
      throw new ForbiddenException('Seul le client peut annuler sa demande.');
    }
    if (commande.status !== 'PENDING_PAYMENT') {
      throw new ConflictException({
        message: 'Cette commande est déjà engagée : écrivez-nous pour l’interrompre.',
        code: 'service_order_engaged',
      });
    }
    return { order: await this.ecrireTransition(commande, 'CANCELLED', 'Demande annulée par le client.', 'client') };
  }

  // ───────────────────────── Suivi d'exécution (équipe) ─────────────────────────

  /**
   * Avancement par l'équipe. `PAID` n'est jamais écrit ici : seule la confirmation du
   * paiement le pose, faute de quoi une prestation pourrait être déclarée payée sans
   * qu'un franc soit arrivé.
   */
  async advance(
    reference: string,
    user: SessionUser,
    input: AdvanceServiceOrderRequest,
  ): Promise<ServiceOrderResponse> {
    const commande = await this.trouver(reference, user);

    if (input.status === 'PAID') {
      throw new ConflictException({
        message: 'L’état « payée » est écrit par la confirmation du paiement, pas à la main.',
        code: 'service_order_paid_is_automatic',
      });
    }
    if (!canTransitionServiceOrder(commande.status, input.status)) {
      throw new ConflictException({
        message: `Une commande « ${SERVICE_ORDER_STATUS_LABELS[commande.status].label.toLowerCase()} » ne peut pas passer à « ${SERVICE_ORDER_STATUS_LABELS[input.status].label.toLowerCase()} ».`,
        code: 'service_order_transition_refused',
      });
    }

    return { order: await this.ecrireTransition(commande, input.status, input.note ?? null, 'equipe') };
  }

  private async ecrireTransition(
    commande: LigneCommande,
    vers: ServiceOrderStatus,
    note: string | null,
    source: string,
  ): Promise<ServiceOrderDetail> {
    // Écriture conditionnée à l'état de départ : deux écritures concurrentes ne peuvent
    // pas franchir la même étape deux fois.
    const { count } = await this.prisma.serviceOrder.updateMany({
      where: { id: commande.id, status: commande.status },
      data: {
        status: vers,
        ...(vers === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      },
    });
    if (count === 0) {
      throw new ConflictException({
        message: 'Cette commande vient de changer d’état. Rechargez la page.',
        code: 'service_order_conflict',
      });
    }

    await this.prisma.serviceOrderEvent.create({
      data: { serviceOrderId: commande.id, fromStatus: commande.status, toStatus: vers, note, source },
    });

    const fraiche = await this.prisma.serviceOrder.findUniqueOrThrow({
      where: { id: commande.id },
      include: ServicesService.INCLUSION,
    });
    return this.detailCommande(fraiche as unknown as LigneCommande);
  }

  /** Dépôt d'un livrable par l'équipe. Refusé tant que la prestation n'est pas payée. */
  async addDeliverable(
    reference: string,
    user: SessionUser,
    input: AddServiceDeliverableRequest,
  ): Promise<ServiceOrderResponse> {
    const commande = await this.trouver(reference, user);
    if (commande.paidAt === null) {
      throw new ConflictException({
        message: 'Aucun livrable ne peut être déposé avant le paiement de la prestation.',
        code: 'service_order_not_paid',
      });
    }

    await this.prisma.serviceDeliverable.create({
      data: {
        serviceOrderId: commande.id,
        title: input.title,
        fileFormat: input.fileFormat,
        sizeBytes: input.sizeBytes ?? null,
        url: input.url,
        note: input.note ?? null,
      },
    });

    const fraiche = await this.prisma.serviceOrder.findUniqueOrThrow({
      where: { id: commande.id },
      include: ServicesService.INCLUSION,
    });
    return { order: await this.detailCommande(fraiche as unknown as LigneCommande) };
  }
}
