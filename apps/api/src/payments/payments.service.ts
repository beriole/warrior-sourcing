import { Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  canTransitionPayment,
  DELIVERY_MODE_LABELS,
  isFinalPaymentStatus,
  PAYMENT_METHOD_LABELS,
  PAYMENT_MINIMUM_XAF,
  PAYMENT_STATUS_LABELS,
  type CheckoutPaymentMethod,
  type PaymentStatus,
  type PaymentStateResponse,
  type PaymentSummary,
  type ReconcileResponse,
  type WebhookAckResponse,
} from '@ws/contracts';
import { randomBytes } from 'node:crypto';
import type { Env } from '../config/env.js';
import type { Payment, Prisma } from '../generated/prisma/client.js';
import { AccessActivation } from '../billing/access-activation.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PAYMENT_PROVIDER,
  PaymentProviderError,
  type PaymentProvider,
  type ProviderTransaction,
} from './payment-provider.js';

/** Durée de validité d'une demande de paiement avant qu'on la considère expirée. */
const PAYMENT_TTL_MS = 24 * 60 * 60 * 1000;
/** Espacement minimal entre deux consultations d'état chez l'agrégateur (6 par minute au plus). */
const MIN_CHECK_INTERVAL_MS = 10_000;
/** Plafond de l'espacement progressif lors de la réconciliation. */
const MAX_CHECK_INTERVAL_MS = 10 * 60 * 1000;

type PaymentWithOrder = Prisma.PaymentGetPayload<{
  include: { order: { include: { lines: true; campaign: true } }; user: true };
}>;

const INCLUDE_ORDER = { order: { include: { lines: true, campaign: true } }, user: true } as const;

/**
 * Paiements Mobile Money (PAY-01).
 *
 * Toute écriture d'état passe par `canTransitionPayment` ; l'état SUCCEEDED n'est écrit
 * qu'après relecture chez l'agrégateur, jamais sur la seule foi d'un webhook.
 * Un webhook rejoué retombe sur une transition déjà faite et est ignoré sans erreur.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly activation: AccessActivation,
    private readonly config: ConfigService<Env, true>,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  // ───────────────────────── Initiation ─────────────────────────

  /**
   * Crée le paiement d'une commande et pousse la demande sur le téléphone du client.
   * Si l'agrégateur refuse, le paiement est marqué FAILED et la commande reste payable.
   */
  async initiateForOrder(input: {
    /** Commande, prestation, abonnement ou formation à l'unité : un seul des quatre. */
    orderId?: string;
    serviceOrderId?: string;
    subscriptionId?: string;
    coursePurchaseId?: string;
    user: { id: string; name: string; email: string };
    amountXaf: number;
    method: CheckoutPaymentMethod;
    payerPhone: string;
    message: string;
  }): Promise<PaymentSummary> {
    if (!Number.isInteger(input.amountXaf) || input.amountXaf < PAYMENT_MINIMUM_XAF) {
      throw new ServiceUnavailableException({
        message: `Le montant minimum d’un paiement est de ${PAYMENT_MINIMUM_XAF} FCFA.`,
        code: 'amount_too_low',
      });
    }

    const payment = await this.prisma.payment.create({
      data: {
        reference: paymentReference(),
        userId: input.user.id,
        orderId: input.orderId ?? null,
        serviceOrderId: input.serviceOrderId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        coursePurchaseId: input.coursePurchaseId ?? null,
        method: input.method,
        status: 'INITIATED',
        amountXaf: input.amountXaf,
        provider: this.provider.name,
        payerPhone: input.payerPhone,
        expiresAt: new Date(Date.now() + PAYMENT_TTL_MS),
        events: { create: { fromStatus: null, toStatus: 'INITIATED', source: 'checkout' } },
      },
    });

    try {
      const result = await this.provider.initiate({
        amountXaf: input.amountXaf,
        phone: input.payerPhone,
        method: input.method,
        reference: payment.reference,
        userId: input.user.id,
        email: input.user.email,
        name: input.user.name,
        message: input.message,
      });

      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerRef: result.providerRef, providerLink: result.link },
      });
      return this.toSummary(updated);
    } catch (error) {
      const reason =
        error instanceof PaymentProviderError ? error.message : 'Le service de paiement n’a pas répondu.';
      this.logger.warn(`Initiation refusée pour ${payment.reference} : ${reason}`);
      await this.transition(payment, 'FAILED', 'initiation', { reason }, { failureReason: reason });
      throw new ServiceUnavailableException({
        message: 'Le paiement n’a pas pu être lancé. Vérifiez le numéro, puis réessayez dans un instant.',
        code: 'payment_initiation_failed',
      });
    }
  }

  // ───────────────────────── Consultation ─────────────────────────

  /** Paiement d'un client, avec rafraîchissement espacé de l'état s'il n'est pas conclu. */
  async findForUser(reference: string, userId: string): Promise<PaymentSummary> {
    const payment = await this.prisma.payment.findFirst({ where: { reference, userId } });
    if (!payment) throw new NotFoundException('Ce paiement n’existe pas.');
    return this.toSummary(await this.refreshIfDue(payment, MIN_CHECK_INTERVAL_MS));
  }

  /**
   * État d'un paiement, sans session (souscription publique, §43).
   *
   * Ne renvoie que l'état et sa consigne : ni montant, ni numéro, ni rien qui désigne un
   * client. Une référence devinée n'apprend donc rien qu'elle ne sache déjà. Une
   * référence inconnue renvoie 404, comme ailleurs : prétendre « en attente » pour une
   * référence qui n'existe pas ferait tourner l'écran dans le vide.
   */
  async stateFor(reference: string): Promise<PaymentStateResponse> {
    const payment = await this.prisma.payment.findUnique({ where: { reference } });
    if (!payment) throw new NotFoundException('Ce paiement n’existe pas.');

    const fresh = await this.refreshIfDue(payment, MIN_CHECK_INTERVAL_MS);
    return {
      status: fresh.status,
      statusLabel: PAYMENT_STATUS_LABELS[fresh.status],
      instruction: instructionFor(fresh),
      settled: isFinalPaymentStatus(fresh.status) || fresh.status === 'SUCCEEDED',
    };
  }

  /** Dernier paiement d'une commande, pour l'écran de confirmation et le reçu. */
  async latestForOrder(orderId: string): Promise<Payment | null> {
    return this.prisma.payment.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  }

  /** Dernier paiement d'une commande de prestation (lot SRV). */
  async latestForServiceOrder(serviceOrderId: string): Promise<Payment | null> {
    return this.prisma.payment.findFirst({ where: { serviceOrderId }, orderBy: { createdAt: 'desc' } });
  }

  toSummary(payment: Payment): PaymentSummary {
    return {
      reference: payment.reference,
      status: payment.status,
      statusLabel: PAYMENT_STATUS_LABELS[payment.status],
      method: payment.method,
      methodLabel: PAYMENT_METHOD_LABELS[payment.method],
      amountXaf: payment.amountXaf,
      provider: payment.provider,
      paymentLink: payment.providerLink,
      payerPhone: payment.payerPhone,
      failureReason: payment.failureReason,
      paidAt: payment.paidAt?.toISOString() ?? null,
      expiresAt: payment.expiresAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      instruction: instructionFor(payment),
    };
  }

  // ───────────────────────── Webhook ─────────────────────────

  /**
   * Webhook de l'agrégateur. Le corps n'est pas cru sur parole : l'état est relu chez lui.
   * Retourne toujours 200 une fois le secret vérifié, même pour une transaction inconnue,
   * pour que l'agrégateur ne rejoue pas indéfiniment.
   */
  async handleWebhook(secret: string | undefined, body: unknown): Promise<WebhookAckResponse> {
    const providerRef = this.provider.webhookProviderRef(body);
    if (!providerRef) {
      this.logger.warn('Webhook sans identifiant de transaction, ignoré.');
      return { received: true, outcome: 'ignored' };
    }

    const payment = await this.prisma.payment.findUnique({ where: { providerRef } });
    if (!payment) {
      this.logger.warn(`Webhook pour une transaction inconnue (${providerRef}), ignoré.`);
      return { received: true, outcome: 'ignored' };
    }
    if (isFinalPaymentStatus(payment.status) || payment.status === 'SUCCEEDED') {
      return { received: true, outcome: 'ignored' };
    }

    let transaction: ProviderTransaction;
    try {
      transaction = await this.provider.status(providerRef);
    } catch (error) {
      // L'agrégateur ne répond pas : la réconciliation reprendra plus tard.
      this.logger.warn(`Confirmation impossible pour ${providerRef} : ${describeError(error)}`);
      return { received: true, outcome: 'deferred' };
    }

    const applied = await this.applyTransaction(payment, transaction, 'webhook');
    return { received: true, outcome: applied ? 'applied' : 'ignored' };
  }

  // ───────────────────────── Réconciliation ─────────────────────────

  /**
   * Relit chez l'agrégateur les paiements encore ouverts, avec un espacement progressif.
   * Un paiement passé sa date de validité et toujours non conclu est marqué EXPIRÉ.
   */
  async reconcilePending(): Promise<ReconcileResponse> {
    const pending = await this.prisma.payment.findMany({
      where: { status: { in: ['INITIATED', 'PENDING'] }, providerRef: { not: null } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    const result: ReconcileResponse = { checked: 0, updated: 0, skipped: 0 };
    for (const payment of pending) {
      const interval = Math.min(MIN_CHECK_INTERVAL_MS * 2 ** payment.checkCount, MAX_CHECK_INTERVAL_MS);
      const before = payment.status;
      const after = await this.refreshIfDue(payment, interval, 'reconcile');
      if (after.lastCheckedAt?.getTime() === payment.lastCheckedAt?.getTime()) {
        result.skipped += 1;
        continue;
      }
      result.checked += 1;
      if (after.status !== before) result.updated += 1;
    }
    return result;
  }

  /** Relit l'état si la dernière vérification date d'assez longtemps ; sinon renvoie l'état connu. */
  private async refreshIfDue(payment: Payment, intervalMs: number, source = 'poll'): Promise<Payment> {
    if (isFinalPaymentStatus(payment.status) || payment.status === 'SUCCEEDED' || !payment.providerRef) {
      return payment;
    }
    const last = payment.lastCheckedAt?.getTime() ?? 0;
    if (Date.now() - last < intervalMs) return payment;

    const checked = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { lastCheckedAt: new Date(), checkCount: { increment: 1 } },
    });

    let transaction: ProviderTransaction;
    try {
      transaction = await this.provider.status(payment.providerRef);
    } catch (error) {
      this.logger.warn(`État illisible pour ${payment.reference} : ${describeError(error)}`);
      return checked;
    }

    await this.applyTransaction(checked, transaction, source);
    const fresh = (await this.prisma.payment.findUnique({ where: { id: payment.id } })) ?? checked;

    // Toujours ouvert après sa date de validité : on ferme de notre côté.
    if (!isFinalPaymentStatus(fresh.status) && fresh.status !== 'SUCCEEDED' && fresh.expiresAt && fresh.expiresAt < new Date()) {
      return this.transition(fresh, 'EXPIRED', source, { reason: 'Délai de paiement dépassé' }, {
        failureReason: 'Délai de paiement dépassé.',
      });
    }
    return fresh;
  }

  // ───────────────────────── Machine à états ─────────────────────────

  /**
   * Applique l'état rapporté par l'agrégateur. Retourne vrai si une transition a été écrite.
   * Fapshi peut passer directement de CREATED à SUCCESSFUL : l'étape PENDING est alors jouée
   * pour respecter PAYMENT_TRANSITIONS.
   */
  private async applyTransaction(payment: Payment, transaction: ProviderTransaction, source: string): Promise<boolean> {
    const target = transaction.status;
    if (target === payment.status || target === 'INITIATED') return false;

    if (target === 'SUCCEEDED' && transaction.amountXaf !== null && transaction.amountXaf !== payment.amountXaf) {
      this.logger.error(
        `Montant confirmé (${transaction.amountXaf}) différent du montant attendu (${payment.amountXaf}) pour ${payment.reference} : SUCCEEDED refusé.`,
      );
      await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          fromStatus: payment.status,
          toStatus: payment.status,
          source,
          payload: { rejected: 'amount_mismatch', ...transaction.raw } as Prisma.InputJsonValue,
        },
      });
      return false;
    }

    let current = payment;
    let written = false;

    if (current.status === 'INITIATED' && target === 'SUCCEEDED') {
      const stepped = await this.transition(current, 'PENDING', source, transaction.raw);
      if (stepped.status !== 'PENDING') return false;
      current = stepped;
      written = true;
    }

    if (!canTransitionPayment(current.status, target)) return written;

    const extra: Prisma.PaymentUpdateInput =
      target === 'SUCCEEDED'
        ? { paidAt: transaction.confirmedAt ?? new Date() }
        : target === 'FAILED' || target === 'EXPIRED'
          ? { failureReason: transaction.reason ?? PAYMENT_STATUS_LABELS[target] }
          : {};

    const next = await this.transition(current, target, source, transaction.raw, extra);
    if (next.status !== target) return written;

    if (target === 'SUCCEEDED') await this.onSucceeded(next.id);
    return true;
  }

  /**
   * Ouverture d'un abonnement à la confirmation du paiement.
   *
   * Toute la suite — bascule de l'état, identifiants engendrés quand le compte est né de
   * cette souscription, courriel d'activation — appartient à `SubscriptionActivation`,
   * que l'activation immédiate d'une offre gratuite appelle aussi. Un seul code décide
   * d'envoyer un mot de passe.
   */
  private async onSubscriptionPaid(subscriptionId: string): Promise<void> {
    await this.activation.activateSubscription(subscriptionId);
  }

  /**
   * Passage d'une commande de prestation à « payée ».
   *
   * Idempotent par construction : le `updateMany` ne mord que sur une commande encore en
   * attente de paiement, donc un webhook rejoué ne réécrit rien et ne duplique pas
   * l'étape de suivi que le client lit.
   */
  private async onServiceOrderPaid(serviceOrderId: string, paidAt: Date): Promise<void> {
    const { count } = await this.prisma.serviceOrder.updateMany({
      where: { id: serviceOrderId, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID', paidAt },
    });
    if (count === 0) return;

    await this.prisma.serviceOrderEvent.create({
      data: {
        serviceOrderId,
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'PAID',
        source: 'payment',
        note: 'Paiement reçu. Un intervenant prend la demande en charge.',
      },
    });
  }

  /**
   * Écrit une transition de façon atomique : la mise à jour n'aboutit que si l'état de départ
   * est encore celui attendu. Deux webhooks concurrents ne peuvent donc pas l'écrire deux fois.
   */
  private async transition(
    payment: Payment,
    to: PaymentStatus,
    source: string,
    payload?: Record<string, unknown>,
    extra: Prisma.PaymentUpdateInput = {},
  ): Promise<Payment> {
    if (!canTransitionPayment(payment.status, to)) return payment;

    const { count } = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: payment.status },
      data: { status: to, ...(extra as Prisma.PaymentUpdateManyMutationInput) },
    });
    if (count === 0) {
      return (await this.prisma.payment.findUnique({ where: { id: payment.id } })) ?? payment;
    }

    await this.prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: to,
        source,
        payload: (payload ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    this.logger.log(`Paiement ${payment.reference} : ${payment.status} → ${to} (${source})`);
    return (await this.prisma.payment.findUnique({ where: { id: payment.id } })) ?? payment;
  }

  // ───────────────────────── Effets d'un paiement réussi ─────────────────────────

  /** Marque la commande payée puis lance les emails en arrière-plan : rien ici ne bloque. */
  private async onSucceeded(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: INCLUDE_ORDER });
    if (!payment) return;

    // Un paiement règle une commande, une prestation (lot SRV) ou un abonnement (lot SUB).
    if (payment.serviceOrderId) {
      await this.onServiceOrderPaid(payment.serviceOrderId, payment.paidAt ?? new Date());
      return;
    }
    if (payment.subscriptionId) {
      await this.onSubscriptionPaid(payment.subscriptionId);
      return;
    }
    if (payment.coursePurchaseId) {
      await this.activation.activateCoursePurchase(payment.coursePurchaseId);
      return;
    }
    if (!payment.order) return;

    // Idempotent : une commande déjà payée ne change pas.
    await this.prisma.order.updateMany({
      where: { id: payment.order.id, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID', paidAt: payment.paidAt ?? new Date(), stage: 'ORDER_PAID' },
    });

    void this.sendConfirmationEmails(payment).catch((error: unknown) => {
      this.logger.error(`Emails de confirmation non envoyés pour ${payment.reference} : ${describeError(error)}`);
    });
  }

  private async sendConfirmationEmails(payment: PaymentWithOrder): Promise<void> {
    const order = payment.order;
    if (!order) return;
    const appUrl = this.config.get('APP_URL', { infer: true });
    const firstName = payment.user.name.split(' ')[0] ?? '';
    const orderUrl = `${appUrl}/commandes/${order.reference}`;
    const firstLine = order.lines[0];

    const results = await Promise.allSettled([
      this.mail.send({
        to: payment.user.email,
        userId: payment.userId,
        template: 'payment-confirmed',
        data: {
          firstName,
          orderReference: order.reference,
          transactionReference: payment.reference,
          amount: { amountMinor: payment.amountXaf, currency: 'XAF' },
          method: payment.method,
          paidAt: payment.paidAt ?? new Date(),
          productLabel: firstLine?.label ?? 'Votre commande',
          quantity: firstLine?.quantity,
          trackingUrl: `${orderUrl}#suivi`,
          receiptUrl: `${orderUrl}#recu`,
          nextStep: nextStepFor(order.kind),
        },
      }),
      this.mail.send({
        to: payment.user.email,
        userId: payment.userId,
        template: 'order-confirmed',
        data: {
          firstName,
          orderReference: order.reference,
          createdAt: order.createdAt,
          lines: order.lines.map((line) => ({
            label: line.label,
            quantity: line.quantity,
            unitPrice: { amountMinor: line.unitPriceXaf, currency: 'XAF' },
          })),
          total: { amountMinor: order.totalXaf, currency: 'XAF' },
          city: order.city,
          deliveryMode: DELIVERY_MODE_LABELS[order.deliveryMode].label,
          estimatedArrival: order.campaign?.leadTime ?? 'Communiquée après confirmation du fournisseur',
          orderUrl,
        },
      }),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(`Un email de confirmation a échoué pour ${order.reference} : ${describeError(result.reason)}`);
      }
    }
  }
}

/** Ce qui suit un paiement réussi, en une phrase (§24). */
export function nextStepFor(kind: 'STANDARD' | 'PREORDER'): string {
  return kind === 'PREORDER'
    ? 'Votre participation est enregistrée. La commande groupée part dès que la quantité minimale est atteinte, au plus tard à la clôture de la campagne.'
    : 'Nous confirmons la commande auprès du fournisseur sous 48 heures ouvrées, puis la production démarre.';
}

function instructionFor(payment: Payment): string {
  switch (payment.status) {
    case 'INITIATED':
    case 'PENDING':
      // Le paiement est toujours poussé sur un téléphone (Fapshi `direct-pay`). Le cas
      // sans numéro ne devrait pas exister ; s'il survenait, mieux vaut une consigne
      // honnête qu'une invitation à ouvrir un lien qui n'a pas été créé.
      return payment.payerPhone
        ? `Une demande de paiement a été envoyée au ${formatPhone(payment.payerPhone)}. Validez-la sur votre téléphone avec votre code secret ${PAYMENT_METHOD_LABELS[payment.method]}.`
        : 'La demande de paiement est en cours. Gardez votre téléphone à portée de main.';
    case 'SUCCEEDED':
      return 'Paiement reçu. Votre commande est confirmée.';
    case 'FAILED':
      return 'Le paiement n’a pas abouti. Vous pouvez relancer une demande depuis votre commande.';
    case 'EXPIRED':
      return 'La demande de paiement a expiré. Vous pouvez en relancer une depuis votre commande.';
    case 'REFUNDED':
      return 'Ce paiement a été remboursé.';
    case 'PARTIALLY_REFUNDED':
      return 'Ce paiement a été partiellement remboursé.';
  }
}

function formatPhone(phone: string): string {
  return phone.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
}

/** Référence de paiement lisible : PAY-XXXXXXXX, alphabet sans caractères ambigus. */
export function paymentReference(): string {
  return `PAY-${randomCode(8)}`;
}

export function randomCode(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
