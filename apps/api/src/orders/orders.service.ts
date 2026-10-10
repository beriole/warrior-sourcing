import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DELIVERY_MODE_LABELS,
  ORDER_STATUS_LABELS,
  SHIPMENT_STAGE_LABELS,
  type CheckoutQuoteRequest,
  type CheckoutQuoteResponse,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type FeeBreakdown,
  type OrderDetail,
  type OrderListResponse,
  type OrderSummary,
  type ParticipatePreorderRequest,
} from '@ws/contracts';
import { estimateLandedCost } from '../catalog/landed-cost.js';
import type { Payment, Prisma, Product } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { nextStepFor, PaymentsService, randomCode } from '../payments/payments.service.js';
import type { SessionUser } from '../auth/auth.guard.js';

type OrderRecord = Prisma.OrderGetPayload<{ include: { lines: true; campaign: true } }>;

const INCLUDE = { lines: true, campaign: true } as const;

/** Ce que le total d'une commande classique ne couvre pas : dit avant paiement, jamais après. */
const STANDARD_EXCLUSIONS = [
  'Les frais de livraison locale à domicile, réglés directement au livreur.',
  'L’écart entre les droits et taxes estimés et ceux réellement acquittés au dédouanement, régularisé sur justificatif.',
];

/**
 * Commandes et précommandes (ORD-01 à ORD-05).
 *
 * Le total est calculé ici, et seulement ici : le client envoie un produit, une quantité,
 * une ville, un mode de réception et un numéro ; jamais un montant.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  // ───────────────────────── Devis et checkout ─────────────────────────

  /** Résumé complet des frais avant paiement, sans rien enregistrer (§23). */
  async quote(input: CheckoutQuoteRequest): Promise<CheckoutQuoteResponse> {
    const product = await this.findPublishedProduct(input.productSlug);
    return {
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images[0] ? { url: product.images[0].url, alt: product.images[0].alt } : null,
        unitPriceXaf: product.purchasePriceXaf,
        moq: product.moq,
      },
      quantity: input.quantity,
      belowMinimumOrder: input.quantity < product.moq,
      fees: this.feesForProduct(product, input.quantity),
    };
  }

  /** Crée la commande, fige les lignes et lance le paiement dans la foulée. */
  async create(user: SessionUser, input: CreateOrderRequest): Promise<CreateOrderResponse> {
    const product = await this.findPublishedProduct(input.productSlug);
    if (input.quantity < product.moq) {
      throw new BadRequestException({
        message: `Ce fournisseur n’accepte pas moins de ${product.moq} pièces par commande.`,
        code: 'below_minimum_order',
        issues: [{ path: 'quantity', message: `Quantité minimum : ${product.moq}.` }],
      });
    }

    const fees = this.feesForProduct(product, input.quantity);
    const order = await this.prisma.order.create({
      data: {
        reference: orderReference(),
        userId: user.id,
        kind: 'STANDARD',
        status: 'PENDING_PAYMENT',
        subtotalXaf: fees.subtotalXaf,
        freightXaf: fees.freightXaf,
        serviceFeeXaf: fees.serviceFeeXaf,
        customsXaf: fees.customsXaf,
        totalXaf: fees.totalXaf,
        city: input.city,
        deliveryMode: input.deliveryMode,
        phone: input.phone,
        shippingMode: 'AIR',
        lines: {
          create: {
            productId: product.id,
            productSlug: product.slug,
            label: product.name,
            quantity: input.quantity,
            unitPriceXaf: product.purchasePriceXaf,
            lineTotalXaf: product.purchasePriceXaf * input.quantity,
          },
        },
      },
      include: INCLUDE,
    });

    const payment = await this.payments.initiateForOrder({
      orderId: order.id,
      user,
      amountXaf: order.totalXaf,
      method: input.paymentMethod,
      payerPhone: input.payerPhone ?? input.phone,
      message: `Commande ${order.reference} — ${product.name}`,
    });

    return { order: this.toDetail(order, payment), payment };
  }

  /** Relance un paiement sur une commande encore impayée dont la demande précédente a échoué ou expiré. */
  async retryPayment(
    user: SessionUser,
    reference: string,
    input: { paymentMethod: CreateOrderRequest['paymentMethod']; payerPhone?: string },
  ): Promise<CreateOrderResponse> {
    const order = await this.findOwned(reference, user.id);
    if (order.status !== 'PENDING_PAYMENT') {
      throw new ConflictException({ message: 'Cette commande n’attend plus de paiement.', code: 'order_not_payable' });
    }
    const latest = await this.payments.latestForOrder(order.id);
    if (latest && (latest.status === 'INITIATED' || latest.status === 'PENDING')) {
      const summary = this.payments.toSummary(latest);
      throw new ConflictException({
        message: `Une demande de paiement est déjà en cours (${summary.reference}). Validez-la ou attendez son expiration.`,
        code: 'payment_in_progress',
      });
    }

    const payment = await this.payments.initiateForOrder({
      orderId: order.id,
      user,
      amountXaf: order.totalXaf,
      method: input.paymentMethod,
      payerPhone: input.payerPhone ?? order.phone,
      message: `Commande ${order.reference}`,
    });
    return { order: this.toDetail(order, payment), payment };
  }

  // ───────────────────────── Consultation ─────────────────────────

  /** Historique du client connecté, du plus récent au plus ancien (ORD-05). */
  async listForUser(userId: string): Promise<OrderListResponse> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { orders: orders.map((order) => this.toSummary(order)) };
  }

  /** Toutes les commandes, pour l'administration. */
  async listAll(): Promise<OrderListResponse> {
    const orders = await this.prisma.order.findMany({ include: INCLUDE, orderBy: { createdAt: 'desc' }, take: 200 });
    return { orders: orders.map((order) => this.toSummary(order)) };
  }

  /** Détail d'une commande du client, avec son dernier paiement rafraîchi si nécessaire. */
  async detailForUser(reference: string, userId: string): Promise<OrderDetail> {
    const order = await this.findOwned(reference, userId);
    const latest = await this.payments.latestForOrder(order.id);
    const payment = latest ? await this.payments.findForUser(latest.reference, userId) : null;
    // Le rafraîchissement du paiement peut avoir marqué la commande payée entre-temps.
    const fresh = payment?.status === 'SUCCEEDED' && order.status !== 'PAID' ? await this.findOwned(reference, userId) : order;
    return this.toDetail(fresh, payment);
  }

  /** Données du reçu : commande payée et paiement réussi, sinon rien à délivrer. */
  async receiptData(reference: string, userId: string): Promise<{ order: OrderRecord; payment: Payment; customerName: string }> {
    const order = await this.findOwned(reference, userId);
    if (order.status !== 'PAID') {
      throw new NotFoundException({ message: 'Le reçu n’est disponible qu’une fois le paiement confirmé.', code: 'receipt_unavailable' });
    }
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: order.id, status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      throw new NotFoundException({ message: 'Aucun paiement confirmé pour cette commande.', code: 'receipt_unavailable' });
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return { order, payment, customerName: user?.name ?? '' };
  }

  // ───────────────────────── Précommandes (§22) ─────────────────────────

  /** Participation : une commande PREORDER au prix de la campagne, payée tout de suite. */
  async participate(user: SessionUser, slug: string, input: ParticipatePreorderRequest): Promise<CreateOrderResponse> {
    const campaign = await this.prisma.preorderCampaign.findUnique({ where: { slug } });
    if (!campaign || campaign.status === 'DRAFT') throw new NotFoundException('Cette campagne n’existe pas.');
    if (campaign.status !== 'OPEN' || campaign.endsAt < new Date()) {
      throw new ConflictException({ message: 'Cette campagne n’accepte plus de participations.', code: 'campaign_closed' });
    }

    const subtotal = campaign.unitPriceXaf * input.quantity;
    const order = await this.prisma.order.create({
      data: {
        reference: orderReference(),
        userId: user.id,
        kind: 'PREORDER',
        status: 'PENDING_PAYMENT',
        subtotalXaf: subtotal,
        totalXaf: subtotal,
        city: input.city,
        deliveryMode: input.deliveryMode,
        phone: input.phone,
        campaignId: campaign.id,
        lines: {
          create: {
            productId: campaign.productId,
            productSlug: null,
            label: campaign.title,
            quantity: input.quantity,
            unitPriceXaf: campaign.unitPriceXaf,
            lineTotalXaf: subtotal,
          },
        },
      },
      include: INCLUDE,
    });

    const payment = await this.payments.initiateForOrder({
      orderId: order.id,
      user,
      amountXaf: order.totalXaf,
      method: input.paymentMethod,
      payerPhone: input.payerPhone ?? input.phone,
      message: `Précommande ${order.reference} — ${campaign.title}`,
    });

    return { order: this.toDetail(order, payment), payment };
  }

  // ───────────────────────── Projections ─────────────────────────

  toSummary(order: OrderRecord): OrderSummary {
    const first = order.lines[0];
    const itemCount = order.lines.reduce((sum, line) => sum + line.quantity, 0);
    return {
      id: order.id,
      reference: order.reference,
      kind: order.kind,
      status: order.status,
      statusLabel: ORDER_STATUS_LABELS[order.status],
      stage: order.stage,
      stageLabel: SHIPMENT_STAGE_LABELS[order.stage],
      totalXaf: order.totalXaf,
      headline: first ? (order.lines.length > 1 ? `${first.label} et ${order.lines.length - 1} autre(s)` : first.label) : 'Commande',
      itemCount,
      city: order.city,
      deliveryMode: order.deliveryMode,
      deliveryModeLabel: DELIVERY_MODE_LABELS[order.deliveryMode].label,
      paidAt: order.paidAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
    };
  }

  toDetail(order: OrderRecord, payment: OrderDetail['payment']): OrderDetail {
    return {
      ...this.toSummary(order),
      phone: order.phone,
      lines: order.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        productSlug: line.productSlug,
        label: line.label,
        quantity: line.quantity,
        unitPriceXaf: line.unitPriceXaf,
        lineTotalXaf: line.lineTotalXaf,
      })),
      fees: this.feesFromOrder(order),
      payment,
      campaign: order.campaign ? { slug: order.campaign.slug, title: order.campaign.title } : null,
      nextStep:
        order.status === 'PAID'
          ? nextStepFor(order.kind)
          : order.status === 'CANCELLED'
            ? 'Cette commande a été annulée.'
            : 'Validez la demande de paiement sur votre téléphone pour confirmer la commande.',
      receiptUrl: order.status === 'PAID' ? `/v1/orders/${order.reference}/receipt.pdf` : null,
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  // ───────────────────────── Calculs ─────────────────────────

  /** Frais d'une commande classique : mêmes hypothèses que la fiche produit, affichées avec le résultat. */
  private feesForProduct(product: Product, quantity: number): FeeBreakdown {
    const estimate = estimateLandedCost(product, quantity);
    return {
      subtotalXaf: estimate.merchandiseXaf,
      freightXaf: estimate.freightXaf,
      serviceFeeXaf: estimate.serviceFeeXaf,
      customsXaf: estimate.customsXaf,
      totalXaf: estimate.totalXaf,
      provenance: 'ESTIMATE',
      assumptions: estimate.assumptions,
      exclusions: STANDARD_EXCLUSIONS,
    };
  }

  /** Frais tels qu'ils ont été figés à la commande. */
  private feesFromOrder(order: OrderRecord): FeeBreakdown {
    if (order.kind === 'PREORDER') {
      return {
        subtotalXaf: order.subtotalXaf,
        freightXaf: 0,
        serviceFeeXaf: 0,
        customsXaf: 0,
        totalXaf: order.totalXaf,
        provenance: 'VERIFIED',
        assumptions: [],
        exclusions: order.campaign?.excluded ?? [],
      };
    }
    return {
      subtotalXaf: order.subtotalXaf,
      freightXaf: order.freightXaf,
      serviceFeeXaf: order.serviceFeeXaf,
      customsXaf: order.customsXaf,
      totalXaf: order.totalXaf,
      provenance: 'ESTIMATE',
      // Les hypothèses en vigueur au moment de la commande sont celles publiées avec le catalogue.
      assumptions: estimateLandedCost({ purchasePriceXaf: 0, weightGrams: 0 }, 1).assumptions,
      exclusions: STANDARD_EXCLUSIONS,
    };
  }

  private async findPublishedProduct(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
    });
    if (!product) throw new NotFoundException('Ce produit n’est pas disponible à la commande.');
    return product;
  }

  private async findOwned(reference: string, userId: string): Promise<OrderRecord> {
    // Filtrer par utilisateur : un client ne voit jamais la commande d'un autre (§40).
    const order = await this.prisma.order.findFirst({ where: { reference, userId }, include: INCLUDE });
    if (!order) throw new NotFoundException('Cette commande n’existe pas.');
    return order;
  }
}

/** Référence lisible : WS-AAAAMMJJ-XXXX. */
export function orderReference(now = new Date()): string {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `WS-${day}-${randomCode(4)}`;
}
