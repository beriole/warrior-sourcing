import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BILLING_PERIOD_LABELS,
  SUBSCRIPTION_RIGHT_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  subscriptionCovers,
  subscriptionEnd,
  type BillingPeriod,
  type MySubscriptionResponse,
  type PublicSubscribeRequest,
  type PublicSubscribeResponse,
  type SubscribeRequest,
  type Subscription,
  type SubscriptionPlan,
  type SubscriptionPlanInput,
  type SubscriptionPlansResponse,
  type SubscriptionRight,
  type SubscriptionStatus,
} from '@ws/contracts';
import { AccountProvisioning } from '../auth/account-provisioning.js';
import type { SessionUser } from '../auth/auth.guard.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PromotionsService } from './promotions.service.js';
import { AccessActivation } from './access-activation.service.js';

type LigneOffre = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  priceXaf: number;
  period: BillingPeriod;
  rights: SubscriptionRight[];
  serviceDiscountPercent: number;
  highlights: string[];
  position: number;
  active: boolean;
  _count?: { subscriptions: number };
};

type LigneAbonnement = {
  id: string;
  status: SubscriptionStatus;
  paidXaf: number;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  plan: { slug: string; name: string; rights: SubscriptionRight[]; serviceDiscountPercent: number };
};

/** Offre servie par défaut quand aucune offre gratuite n'a été créée en base. */
const OFFRE_PAR_DEFAUT = { slug: 'gratuit', name: 'Gratuit' };

/**
 * Abonnements (§43, SUB-01).
 *
 * Les droits sont **recalculés à chaque lecture** à partir de l'abonnement en cours ; ils
 * ne sont jamais stockés sur le compte. Un droit figé sur l'utilisateur survivrait à
 * l'expiration de l'abonnement, et personne ne s'en apercevrait avant longtemps.
 *
 * Un abonnement ne s'active pas à la souscription mais à la confirmation du paiement :
 * c'est le lot PAY qui fait basculer son état, exactement comme pour une commande.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly promotions: PromotionsService,
    private readonly activation: AccessActivation,
    private readonly provisioning: AccountProvisioning,
  ) {}

  private async formatOffre(row: LigneOffre, userId: string | null, code: string | null): Promise<SubscriptionPlan> {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      priceXaf: row.priceXaf,
      period: row.period,
      periodLabel: BILLING_PERIOD_LABELS[row.period].label,
      periodSuffix: BILLING_PERIOD_LABELS[row.period].suffix,
      rights: row.rights,
      rightLabels: row.rights.map((droit) => SUBSCRIPTION_RIGHT_LABELS[droit].label),
      serviceDiscountPercent: row.serviceDiscountPercent,
      highlights: row.highlights,
      position: row.position,
      active: row.active,
      priced: await this.promotions.priceFor(row.priceXaf, { kind: 'PLAN', id: row.id }, userId, code),
      ...(row._count ? { subscriberCount: row._count.subscriptions } : {}),
    };
  }

  private formatAbonnement(row: LigneAbonnement): Subscription {
    return {
      id: row.id,
      planSlug: row.plan.slug,
      planName: row.plan.name,
      status: row.status,
      statusLabel: SUBSCRIPTION_STATUS_LABELS[row.status].label,
      paidXaf: row.paidXaf,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      current: subscriptionCovers(row),
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Abonnement en cours d'un compte, et les droits qui en découlent.
   *
   * Source unique de vérité pour toute vérification de droit : les autres lots
   * l'appellent plutôt que de relire la table eux-mêmes.
   */
  async mine(userId: string): Promise<MySubscriptionResponse> {
    const rows = (await this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: { select: { slug: true, name: true, rights: true, serviceDiscountPercent: true } } },
      orderBy: { endsAt: 'desc' },
      take: 5,
    })) as unknown as LigneAbonnement[];

    const courant = rows.find((row) => subscriptionCovers(row)) ?? null;
    // Le dernier connu sert à montrer un abonnement expiré ou en attente de paiement :
    // sans lui, l'écran laisserait croire que rien n'a jamais été souscrit.
    const aMontrer = courant ?? rows[0] ?? null;

    return {
      subscription: aMontrer ? this.formatAbonnement(aMontrer) : null,
      rights: courant?.plan.rights ?? [],
      serviceDiscountPercent: courant?.plan.serviceDiscountPercent ?? 0,
      planSlug: courant?.plan.slug ?? OFFRE_PAR_DEFAUT.slug,
      planName: courant?.plan.name ?? OFFRE_PAR_DEFAUT.name,
    };
  }

  /** Vrai quand le compte dispose du droit demandé. À appeler depuis les autres lots. */
  async hasRight(userId: string, right: SubscriptionRight): Promise<boolean> {
    const { rights } = await this.mine(userId);
    return rights.includes(right);
  }

  async plans(userId: string | null, code: string | null = null): Promise<SubscriptionPlansResponse> {
    const rows = (await this.prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { priceXaf: 'asc' }],
    })) as unknown as LigneOffre[];

    return {
      plans: await Promise.all(rows.map((row) => this.formatOffre(row, userId, code))),
      mine: userId ? await this.mine(userId) : null,
    };
  }

  /**
   * Souscription depuis un compte connecté. Le montant n'est jamais envoyé par le
   * client : il est repris de l'offre, remise comprise, et figé sur l'abonnement.
   */
  async subscribe(
    user: SessionUser,
    input: SubscribeRequest,
  ): Promise<{ subscription: Subscription; paymentReference: string | null }> {
    const offre = await this.offreOuverte(input.planSlug);

    const existant = await this.mine(user.id);
    if (existant.subscription?.current && existant.planSlug === offre.slug) {
      throw new ConflictException({
        message: 'Vous êtes déjà abonné à cette offre pour la période en cours.',
        code: 'subscription_already_active',
      });
    }

    return this.ouvrir({
      user,
      offre,
      promotionCode: input.promotionCode,
      paymentMethod: input.paymentMethod,
      payerPhone: input.payerPhone ?? user.phoneNumber ?? null,
      provisionCredentials: false,
    });
  }

  /**
   * Souscription sans compte : le compte est créé au passage.
   *
   * Ses identifiants ne sont **pas** engendrés ici mais à la confirmation du paiement —
   * un panier abandonné ne doit pas laisser un mot de passe derrière lui. Quand l'adresse
   * appartient déjà à un compte, on s'y rattache sans rien réinitialiser : envoyer un
   * nouveau mot de passe parce qu'un tiers a payé enfermerait le propriétaire dehors.
   */
  async subscribePublic(input: PublicSubscribeRequest): Promise<PublicSubscribeResponse> {
    const offre = await this.offreOuverte(input.planSlug);

    const { user, created } = await this.provisioning.ensure({ email: input.email, name: input.fullName });

    const existant = await this.mine(user.id);
    if (existant.subscription?.current && existant.planSlug === offre.slug) {
      throw new ConflictException({
        message:
          'Un abonnement à cette offre est déjà en cours pour cette adresse. Connectez-vous pour le consulter.',
        code: 'subscription_already_active',
      });
    }

    const { subscription, paymentReference } = await this.ouvrir({
      user,
      offre,
      promotionCode: input.promotionCode,
      paymentMethod: input.paymentMethod,
      payerPhone: input.payerPhone,
      provisionCredentials: created,
    });

    return {
      subscription,
      paymentReference,
      email: user.email,
      accountCreated: created,
      nextStep: prochaineEtape({
        paiementLance: paymentReference !== null,
        compteCree: created,
        phone: input.payerPhone,
      }),
    };
  }

  /** Offre active portant ce libellé, ou une erreur franche. */
  private async offreOuverte(slug: string): Promise<LigneOffre> {
    const offre = (await this.prisma.subscriptionPlan.findFirst({
      where: { slug, active: true },
    })) as unknown as LigneOffre | null;
    if (!offre) throw new NotFoundException('Cette offre n’existe pas.');
    return offre;
  }

  /**
   * Cœur commun aux deux souscriptions : prix, abonnement, paiement.
   *
   * Une offre gratuite — ou rendue gratuite par une promotion — s'ouvre tout de suite :
   * il n'y a rien à encaisser, donc rien à attendre. Toute autre reste en attente de
   * paiement jusqu'à ce que l'agrégateur confirme.
   */
  private async ouvrir(input: {
    user: { id: string; name: string; email: string };
    offre: LigneOffre;
    promotionCode: string | null;
    paymentMethod: SubscribeRequest['paymentMethod'];
    payerPhone: string | null;
    provisionCredentials: boolean;
  }): Promise<{ subscription: Subscription; paymentReference: string | null }> {
    const { offre, user } = input;

    const prix = await this.promotions.priceFor(
      offre.priceXaf,
      { kind: 'PLAN', id: offre.id },
      user.id,
      input.promotionCode,
    );

    const gratuite = prix.finalXaf === 0;

    // Le numéro est exigé avant toute écriture : créer un abonnement qu'on ne peut pas
    // faire payer ne laisserait qu'une ligne morte à expliquer au client.
    if (!gratuite && !input.payerPhone) {
      throw new BadRequestException({
        message: 'Indiquez le numéro Mobile Money à débiter, à 9 chiffres commençant par 6.',
        code: 'payer_phone_required',
      });
    }

    const startsAt = new Date();
    const endsAt = subscriptionEnd(startsAt, offre.period);

    const abonnement = await this.prisma.subscription.create({
      data: {
        userId: user.id,
        planId: offre.id,
        status: gratuite ? 'ACTIVE' : 'PENDING_PAYMENT',
        paidXaf: prix.finalXaf,
        startsAt,
        endsAt,
        provisionCredentials: input.provisionCredentials,
      },
      include: { plan: { select: { slug: true, name: true, rights: true, serviceDiscountPercent: true } } },
    });

    if (prix.promotionId) {
      await this.promotions.redeem(prix.promotionId, user.id, offre.id, prix.discountXaf);
    }

    if (gratuite) {
      // Rien à encaisser : on passe quand même par l'activation, qui enverra les
      // identifiants si le compte vient d'être créé.
      await this.activation.activateSubscription(abonnement.id, { dejaActif: true });
      return { subscription: this.formatAbonnement(abonnement as unknown as LigneAbonnement), paymentReference: null };
    }

    const paiement = await this.payments.initiateForOrder({
      subscriptionId: abonnement.id,
      user,
      amountXaf: prix.finalXaf,
      method: input.paymentMethod,
      payerPhone: input.payerPhone ?? '',
      message: `Abonnement ${offre.name}`,
    });

    await this.prisma.subscription.update({
      where: { id: abonnement.id },
      data: { paymentReference: paiement.reference },
    });

    return {
      subscription: this.formatAbonnement(abonnement as unknown as LigneAbonnement),
      paymentReference: paiement.reference,
    };
  }

  /** Résiliation : les droits courent jusqu'au terme déjà payé, puis s'arrêtent. */
  async cancel(userId: string): Promise<MySubscriptionResponse> {
    const courant = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', endsAt: { gt: new Date() } },
      orderBy: { endsAt: 'desc' },
    });
    if (!courant) {
      throw new NotFoundException('Vous n’avez pas d’abonnement en cours.');
    }

    // On ne coupe pas une période payée : l'état change, la date de fin ne bouge pas.
    await this.prisma.subscription.update({ where: { id: courant.id }, data: { status: 'CANCELLED' } });
    return this.mine(userId);
  }

  // ───────────────────────── Back-office ─────────────────────────

  async adminPlans(): Promise<{ plans: SubscriptionPlan[] }> {
    const rows = (await this.prisma.subscriptionPlan.findMany({
      include: { _count: { select: { subscriptions: true } } },
      orderBy: [{ position: 'asc' }, { priceXaf: 'asc' }],
    })) as unknown as LigneOffre[];

    return { plans: await Promise.all(rows.map((row) => this.formatOffre(row, null, null))) };
  }

  async createPlan(input: SubscriptionPlanInput): Promise<{ plans: SubscriptionPlan[] }> {
    const existant = await this.prisma.subscriptionPlan.findUnique({ where: { slug: input.slug } });
    if (existant) throw new ConflictException({ message: 'Cet identifiant est déjà pris.', code: 'plan_slug_taken' });

    await this.prisma.subscriptionPlan.create({ data: { ...input } });
    return this.adminPlans();
  }

  async updatePlan(id: string, input: SubscriptionPlanInput): Promise<{ plans: SubscriptionPlan[] }> {
    const existant = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existant) throw new NotFoundException('Cette offre n’existe pas.');

    const homonyme = await this.prisma.subscriptionPlan.findUnique({ where: { slug: input.slug } });
    if (homonyme && homonyme.id !== id) {
      throw new ConflictException({ message: 'Cet identifiant est déjà pris.', code: 'plan_slug_taken' });
    }

    await this.prisma.subscriptionPlan.update({ where: { id }, data: { ...input } });
    return this.adminPlans();
  }
}

/**
 * Ce qui se passe maintenant, en une phrase. Écrite par le serveur parce qu'elle dépend
 * de ce qui a réellement eu lieu : un compte créé ou non, un paiement lancé ou non.
 */
function prochaineEtape(etat: { paiementLance: boolean; compteCree: boolean; phone: string }): string {
  if (!etat.paiementLance) {
    return etat.compteCree
      ? 'Votre compte est créé et vos identifiants de connexion viennent de partir par courriel.'
      : 'Votre offre est ouverte. Connectez-vous avec vos identifiants habituels.';
  }

  const validation = `Une demande de paiement a été envoyée au ${etat.phone}. Validez-la sur votre téléphone avec votre code secret.`;
  return etat.compteCree
    ? `${validation} Vos identifiants de connexion partiront par courriel dès la confirmation.`
    : `${validation} Vos droits s’ouvriront dès la confirmation.`;
}
