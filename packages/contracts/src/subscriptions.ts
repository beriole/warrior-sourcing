import { z } from 'zod';
import { CameroonPhoneSchema } from './api-orders.js';
import { PricedSchema } from './promotions.js';

/**
 * Abonnements (§43, lot SUB).
 *
 * Les offres vivent en base, pas dans le code : les prix changent, et un changement de
 * prix ne doit pas demander un déploiement. Les **droits**, eux, sont une énumération
 * fermée — chacun correspond à une vérification réelle côté serveur, et il ne peut pas y
 * en avoir un qui ne soit branché nulle part.
 *
 * Règle de fond (§54) : le paywall dit ce qu'on obtient, pas ce qu'on rate. Et il ne
 * masque jamais une information de risque — un incident fournisseur reste visible d'un
 * compte gratuit.
 */

const xaf = z.number().int();

// ───────────────────────── Droits ─────────────────────────

/**
 * Ce qu'une offre ouvre. Chaque valeur est vérifiée quelque part dans l'API : ajouter une
 * ligne ici sans écrire la vérification qui va avec donnerait un droit décoratif.
 */
export const SUBSCRIPTION_RIGHTS = [
  'SUPPLIER_CONTACTS',
  'ACADEMY_INCLUDED',
  'PRIORITY_SUPPORT',
  'UNLIMITED_SAVED_CALCULATIONS',
] as const;
export const SubscriptionRightSchema = z.enum(SUBSCRIPTION_RIGHTS);
export type SubscriptionRight = z.infer<typeof SubscriptionRightSchema>;

export const SUBSCRIPTION_RIGHT_LABELS: Record<SubscriptionRight, { label: string; description: string }> = {
  SUPPLIER_CONTACTS: {
    label: 'Coordonnées des fournisseurs',
    description: 'Voir le contact direct des fournisseurs vérifiés, sans achat à l’unité.',
  },
  ACADEMY_INCLUDED: {
    label: 'Formations incluses',
    description: 'Accès aux formations marquées « incluse dans l’abonnement ».',
  },
  PRIORITY_SUPPORT: {
    label: 'Support prioritaire',
    description: 'Vos messages passent en tête de la file de l’équipe.',
  },
  UNLIMITED_SAVED_CALCULATIONS: {
    label: 'Simulations illimitées',
    description: 'Enregistrer et retrouver autant de simulations que nécessaire.',
  },
};

/** Rythme de facturation. */
export const BILLING_PERIODS = ['MONTHLY', 'YEARLY'] as const;
export const BillingPeriodSchema = z.enum(BILLING_PERIODS);
export type BillingPeriod = z.infer<typeof BillingPeriodSchema>;

export const BILLING_PERIOD_LABELS: Record<BillingPeriod, { label: string; suffix: string; months: number }> =
  {
    MONTHLY: { label: 'Mensuel', suffix: 'par mois', months: 1 },
    YEARLY: { label: 'Annuel', suffix: 'par an', months: 12 },
  };

// ───────────────────────── Offres ─────────────────────────

export const SubscriptionPlanInputSchema = z
  .object({
    /** Identifiant stable, utilisé dans les URL et les promotions. */
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9-]+$/, 'L’identifiant ne contient que des minuscules, des chiffres et des tirets.'),
    name: z.string().trim().min(2).max(60),
    /** Une phrase : à qui l'offre s'adresse. */
    tagline: z.string().trim().min(5).max(200),
    /** Prix du cycle, en FCFA entiers. Zéro pour l'offre gratuite. */
    priceXaf: xaf.nonnegative(),
    period: BillingPeriodSchema.default('MONTHLY'),
    rights: z.array(SubscriptionRightSchema).max(SUBSCRIPTION_RIGHTS.length).default([]),
    /** Remise appliquée aux prestations, en pourcentage entier. */
    serviceDiscountPercent: z.number().int().min(0).max(100).default(0),
    /** Ce que l'offre apporte, en clair. Une ligne par avantage réel. */
    highlights: z.array(z.string().trim().min(3).max(200)).max(10).default([]),
    /** Rang d'affichage, du plus simple au plus complet. */
    position: z.number().int().nonnegative().default(0),
    active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    // Une offre payante sans aucun droit ni remise ne vend rien : c'est presque
    // toujours une saisie oubliée, et le client le découvrirait après avoir payé.
    if (value.priceXaf > 0 && value.rights.length === 0 && value.serviceDiscountPercent === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['rights'],
        message: 'Une offre payante doit ouvrir au moins un droit ou une remise.',
      });
    }
  });
export type SubscriptionPlanInput = z.infer<typeof SubscriptionPlanInputSchema>;

export const SubscriptionPlanSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  priceXaf: xaf,
  period: BillingPeriodSchema,
  periodLabel: z.string(),
  periodSuffix: z.string(),
  rights: z.array(SubscriptionRightSchema),
  rightLabels: z.array(z.string()),
  serviceDiscountPercent: z.number().int(),
  highlights: z.array(z.string()),
  position: z.number().int(),
  active: z.boolean(),
  /** Prix affiché, promotion comprise quand il y en a une. */
  priced: PricedSchema,
  /** Nombre d'abonnements en cours sur cette offre. Réservé au back-office. */
  subscriberCount: z.number().int().optional(),
});
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

// ───────────────────────── Abonnement d'un compte ─────────────────────────

export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'PENDING_PAYMENT', 'EXPIRED', 'CANCELLED'] as const;
export const SubscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, { label: string; description: string }> =
  {
    ACTIVE: { label: 'Actif', description: 'Vos droits sont ouverts jusqu’à la date indiquée.' },
    PENDING_PAYMENT: {
      label: 'En attente de paiement',
      description: 'Vos droits s’ouvriront dès la confirmation du paiement.',
    },
    EXPIRED: { label: 'Expiré', description: 'La période est terminée. Renouvelez pour rouvrir vos droits.' },
    CANCELLED: { label: 'Résilié', description: 'Vous ne serez pas débité à nouveau.' },
  };

export const SubscriptionSchema = z.object({
  id: z.string(),
  planSlug: z.string(),
  planName: z.string(),
  status: SubscriptionStatusSchema,
  statusLabel: z.string(),
  /** Montant réellement payé pour la période en cours. */
  paidXaf: xaf,
  startsAt: z.iso.datetime(),
  /** Fin de la période en cours. C'est jusque-là que les droits sont ouverts. */
  endsAt: z.iso.datetime(),
  /** Vrai tant que la période couvre l'instant présent. */
  current: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

/**
 * Ce dont l'interface a besoin pour savoir quoi montrer : l'abonnement en cours s'il
 * existe, et les droits effectifs. Les droits sont recalculés par le serveur à chaque
 * lecture — ils ne sont jamais déduits côté client d'un nom d'offre.
 */
export const MySubscriptionResponseSchema = z.object({
  subscription: SubscriptionSchema.nullable(),
  rights: z.array(SubscriptionRightSchema),
  serviceDiscountPercent: z.number().int(),
  /** Offre gratuite par défaut, quand aucun abonnement payant n'est actif. */
  planSlug: z.string(),
  planName: z.string(),
});
export type MySubscriptionResponse = z.infer<typeof MySubscriptionResponseSchema>;

export const SubscriptionPlansResponseSchema = z.object({
  plans: z.array(SubscriptionPlanSchema),
  /** Offre du compte connecté, `null` sans session. */
  mine: MySubscriptionResponseSchema.nullable(),
});
export type SubscriptionPlansResponse = z.infer<typeof SubscriptionPlansResponseSchema>;

/**
 * Souscription : le montant n'est pas envoyé, le serveur le reprend de l'offre.
 *
 * Le numéro passe par `CameroonPhoneSchema`, le même que les commandes. Il était
 * auparavant accepté en vrac (« 9 à 15 caractères »), et le compte créé par code
 * email n'en a aucun : la demande partait donc vers l'agrégateur avec une chaîne
 * vide, qui la refusait. Un numéro mal formé doit échouer ici, avec une phrase
 * lisible, pas trois appels plus loin.
 */
export const SubscribeRequestSchema = z.object({
  planSlug: z.string().trim().min(1).max(40),
  /** Code promotionnel saisi par le client, le cas échéant. */
  promotionCode: z.string().trim().max(24).nullable().default(null),
  paymentMethod: z.enum(['MTN_MOMO', 'ORANGE_MONEY']),
  /** Absent pour une offre gratuite : il n'y a rien à débiter. */
  payerPhone: CameroonPhoneSchema.optional(),
});
export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema>;

/**
 * Souscription sans compte (§43).
 *
 * On peut payer un abonnement avant d'avoir un compte : le compte est créé au
 * passage, et ses identifiants de connexion sont **engendrés à la confirmation du
 * paiement**, pas à la saisie du formulaire. Deux raisons :
 *
 * - un panier abandonné ne doit pas laisser derrière lui un mot de passe envoyé par
 *   courriel à quelqu'un qui n'a rien payé ;
 * - le mot de passe en clair n'existe alors que le temps d'un envoi, et n'est jamais
 *   écrit en base ni gardé entre deux requêtes.
 *
 * Si l'adresse appartient déjà à un compte, rien n'est engendré : l'abonnement est
 * rattaché au compte existant et son propriétaire se connecte comme d'habitude.
 * Réinitialiser son mot de passe parce qu'un tiers a payé l'enfermerait dehors.
 */
export const PublicSubscribeRequestSchema = z.object({
  planSlug: z.string().trim().min(1).max(40),
  fullName: z
    .string({ error: 'Indiquez votre nom.' })
    .trim()
    .min(2, 'Indiquez votre nom.')
    .max(80, 'Ce nom est trop long.'),
  email: z.string().trim().toLowerCase().pipe(z.email('Indiquez une adresse électronique valide.')),
  payerPhone: CameroonPhoneSchema,
  paymentMethod: z.enum(['MTN_MOMO', 'ORANGE_MONEY']),
  promotionCode: z.string().trim().max(24).nullable().default(null),
});
export type PublicSubscribeRequest = z.infer<typeof PublicSubscribeRequestSchema>;

/**
 * Ce que l'écran apprend après avoir lancé une souscription.
 *
 * `paymentReference` est la seule chose à retenir : c'est elle qui permet de suivre
 * l'état du paiement. `accountCreated` dit si un compte vient d'être créé, donc si des
 * identifiants arriveront par courriel — l'écran ne le devine pas.
 */
export const PublicSubscribeResponseSchema = z.object({
  subscription: SubscriptionSchema,
  paymentReference: z.string().nullable(),
  email: z.string(),
  accountCreated: z.boolean(),
  /** Ce qui se passe maintenant, en une phrase, écrite par le serveur. */
  nextStep: z.string(),
});
export type PublicSubscribeResponse = z.infer<typeof PublicSubscribeResponseSchema>;

/**
 * Fin de période à partir d'un début et d'un rythme.
 *
 * Ajouter des mois plutôt que des jours : un abonnement souscrit le 31 janvier doit
 * courir jusqu'au 28 février, pas jusqu'au 3 mars. `setMonth` ramène de lui-même au
 * dernier jour du mois quand le quantième n'existe pas.
 */
export function subscriptionEnd(startsAt: Date, period: BillingPeriod): Date {
  const fin = new Date(startsAt);
  const quantieme = fin.getDate();
  fin.setMonth(fin.getMonth() + BILLING_PERIOD_LABELS[period].months);
  // Débordement (31 janvier → 3 mars) : on recule au dernier jour du mois visé.
  if (fin.getDate() !== quantieme) fin.setDate(0);
  return fin;
}

/** Vrai quand les droits de cet abonnement couvrent l'instant donné. */
export function subscriptionCovers(
  subscription: { status: SubscriptionStatus; startsAt: Date; endsAt: Date },
  at: Date = new Date(),
): boolean {
  return subscription.status === 'ACTIVE' && subscription.startsAt <= at && subscription.endsAt > at;
}
