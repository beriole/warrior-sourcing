import { z } from 'zod';
import { ShipmentStageSchema } from './logistics.js';
import { PaymentMethodSchema, PaymentStatusSchema } from './payment.js';
import { DataProvenanceSchema } from './provenance.js';

/**
 * Commandes, précommandes et paiements (lots ORD et PAY).
 *
 * Schémas de requête et de réponse de ce lot. Les décrire ici permet au serveur de typer
 * ses contrôleurs et au client du site d'être généré à partir du même contrat.
 * Ne rien écrire ici qui appartienne à un autre lot.
 */

// ───────────────────────── Énumérations (jumelles de orders.prisma) ─────────────────────────

/** Cycle de vie court d'une commande ; le suivi logistique fin vit dans `stage`. */
export const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID', 'CANCELLED'] as const;
export const OrderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'En attente de paiement',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

export const ORDER_KINDS = ['STANDARD', 'PREORDER'] as const;
export const OrderKindSchema = z.enum(ORDER_KINDS);
export type OrderKind = z.infer<typeof OrderKindSchema>;

/** Cahier §23 : mode de réception au Cameroun. */
export const DELIVERY_MODES = ['WAREHOUSE_PICKUP', 'HOME_DELIVERY'] as const;
export const DeliveryModeSchema = z.enum(DELIVERY_MODES);
export type DeliveryMode = z.infer<typeof DeliveryModeSchema>;

export const DELIVERY_MODE_LABELS: Record<DeliveryMode, { label: string; description: string }> = {
  WAREHOUSE_PICKUP: {
    label: 'Retrait en entrepôt',
    description: 'Vous récupérez votre marchandise à notre entrepôt de la ville choisie. Sans frais.',
  },
  HOME_DELIVERY: {
    label: 'Livraison à domicile',
    description: 'Un livreur vous apporte la marchandise. Les frais de livraison locale sont réglés au livreur, ils ne sont pas inclus.',
  },
};

/** Villes de réception proposées au checkout. Toute autre ville reste saisissable. */
export const CHECKOUT_CITIES = ['Douala', 'Yaoundé', 'Bafoussam', 'Bamenda', 'Garoua', 'Maroua', 'Kribi', 'Limbe'] as const;

/** Cahier §22 : état d'une campagne de précommande. */
export const PREORDER_CAMPAIGN_STATUSES = ['DRAFT', 'OPEN', 'CLOSED'] as const;
export const PreorderCampaignStatusSchema = z.enum(PREORDER_CAMPAIGN_STATUSES);
export type PreorderCampaignStatus = z.infer<typeof PreorderCampaignStatusSchema>;

export const PREORDER_CAMPAIGN_STATUS_LABELS: Record<PreorderCampaignStatus, string> = {
  DRAFT: 'En préparation',
  OPEN: 'Ouverte aux participations',
  CLOSED: 'Terminée',
};

/** Moyens de paiement proposés au checkout : Mobile Money uniquement, poussé sur le téléphone. */
export const CHECKOUT_PAYMENT_METHODS = ['MTN_MOMO', 'ORANGE_MONEY'] as const;
export const CheckoutPaymentMethodSchema = z.enum(CHECKOUT_PAYMENT_METHODS);
export type CheckoutPaymentMethod = z.infer<typeof CheckoutPaymentMethodSchema>;

/** Montant minimum accepté par l'agrégateur Mobile Money, en FCFA. */
export const PAYMENT_MINIMUM_XAF = 100;

// ───────────────────────── Champs communs ─────────────────────────

/**
 * Numéro camerounais : 9 chiffres commençant par 6, avec ou sans indicatif +237.
 * Normalisé en 9 chiffres : c'est le format attendu par l'agrégateur.
 */
export const CameroonPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, '').replace(/^(\+|00)?237/, ''))
  .pipe(z.string().regex(/^6\d{8}$/, 'Indiquez un numéro camerounais à 9 chiffres, commençant par 6.'));

const QuantitySchema = z
  .number({ error: 'Indiquez une quantité.' })
  .int('La quantité doit être un nombre entier.')
  .positive('La quantité doit être supérieure à zéro.')
  .max(100_000, 'Cette quantité dépasse ce que nous pouvons traiter en ligne.');

const CitySchema = z
  .string({ error: 'Indiquez votre ville.' })
  .trim()
  .min(2, 'Indiquez votre ville.')
  .max(60, 'Ce nom de ville est trop long.');

export const OrderLineSchema = z.object({
  id: z.string(),
  productId: z.string().nullable(),
  productSlug: z.string().nullable(),
  label: z.string(),
  quantity: z.number().int(),
  unitPriceXaf: z.number().int(),
  lineTotalXaf: z.number().int(),
});
export type OrderLine = z.infer<typeof OrderLineSchema>;

/** Hypothèse ayant servi à un montant estimé : chaque chiffre porte sa source et sa date. */
export const FeeAssumptionSchema = z.object({
  label: z.string(),
  detail: z.string(),
  source: z.string(),
  observedAt: z.iso.datetime(),
});

/** Récapitulatif des frais, tel qu'il est montré avant paiement puis figé sur la commande. */
export const FeeBreakdownSchema = z.object({
  /** Valeur marchandise (prix unitaire × quantité) : prix relevé au catalogue. */
  subtotalXaf: z.number().int(),
  freightXaf: z.number().int(),
  serviceFeeXaf: z.number().int(),
  customsXaf: z.number().int(),
  totalXaf: z.number().int(),
  /** Les frais hors marchandise sont des estimations : leurs hypothèses sont fournies. */
  provenance: DataProvenanceSchema,
  assumptions: z.array(FeeAssumptionSchema),
  /** Ce que le total ne couvre pas, en toutes lettres. */
  exclusions: z.array(z.string()),
});
export type FeeBreakdown = z.infer<typeof FeeBreakdownSchema>;

// ───────────────────────── Paiement ─────────────────────────

export const PaymentSummarySchema = z.object({
  reference: z.string(),
  status: PaymentStatusSchema,
  statusLabel: z.string(),
  method: PaymentMethodSchema,
  methodLabel: z.string(),
  amountXaf: z.number().int(),
  provider: z.string(),
  /** Lien de paiement hébergé, quand l'agrégateur en fournit un. */
  paymentLink: z.string().nullable(),
  payerPhone: z.string().nullable(),
  failureReason: z.string().nullable(),
  paidAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  /** Consigne affichée au client tant que le paiement n'est pas conclu. */
  instruction: z.string(),
});
export type PaymentSummary = z.infer<typeof PaymentSummarySchema>;

export const PaymentResponseSchema = z.object({ payment: PaymentSummarySchema });
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;

/**
 * État d'un paiement, consultable sans session (souscription publique, §43).
 *
 * Volontairement réduit : l'état, sa traduction, la consigne, et la conclusion. Pas de
 * montant, pas de numéro, aucune donnée du client. Le parcours sans compte a besoin de
 * savoir si le paiement a abouti ; il n'a besoin de rien d'autre, et une référence
 * devinée ne doit rien apprendre de plus que « ce paiement a réussi ».
 */
export const PaymentStateResponseSchema = z.object({
  status: PaymentStatusSchema,
  statusLabel: z.string(),
  instruction: z.string(),
  /** Vrai quand l'état ne changera plus : l'écran peut arrêter d'interroger. */
  settled: z.boolean(),
});
export type PaymentStateResponse = z.infer<typeof PaymentStateResponseSchema>;

/** Réponse au webhook et à la réconciliation : ce qui a été fait, sans détail sensible. */
export const WebhookAckResponseSchema = z.object({
  received: z.literal(true),
  /** `applied` : transition écrite ; `ignored` : déjà à jour ou inconnu ; `deferred` : confirmation en attente. */
  outcome: z.enum(['applied', 'ignored', 'deferred']),
});
export type WebhookAckResponse = z.infer<typeof WebhookAckResponseSchema>;

export const ReconcileResponseSchema = z.object({
  checked: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
});
export type ReconcileResponse = z.infer<typeof ReconcileResponseSchema>;

// ───────────────────────── Commandes ─────────────────────────

export const OrderSummarySchema = z.object({
  id: z.string(),
  reference: z.string(),
  kind: OrderKindSchema,
  status: OrderStatusSchema,
  statusLabel: z.string(),
  stage: ShipmentStageSchema,
  stageLabel: z.string(),
  totalXaf: z.number().int(),
  /** Libellé de la première ligne et nombre d'articles, pour la liste. */
  headline: z.string(),
  itemCount: z.number().int(),
  city: z.string(),
  deliveryMode: DeliveryModeSchema,
  deliveryModeLabel: z.string(),
  paidAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type OrderSummary = z.infer<typeof OrderSummarySchema>;

export const OrderDetailSchema = OrderSummarySchema.extend({
  phone: z.string(),
  lines: z.array(OrderLineSchema),
  fees: FeeBreakdownSchema,
  payment: PaymentSummarySchema.nullable(),
  campaign: z.object({ slug: z.string(), title: z.string() }).nullable(),
  /** Ce qui se passe après le paiement, en une phrase (§24). */
  nextStep: z.string(),
  receiptUrl: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});
export type OrderDetail = z.infer<typeof OrderDetailSchema>;

export const OrderListResponseSchema = z.object({
  orders: z.array(OrderSummarySchema),
});
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;

export const OrderResponseSchema = z.object({ order: OrderDetailSchema });
export type OrderResponse = z.infer<typeof OrderResponseSchema>;

/** Devis avant paiement : mêmes règles de calcul que la commande, sans rien enregistrer. */
export const CheckoutQuoteRequestSchema = z.object({
  productSlug: z.string().trim().min(1),
  quantity: QuantitySchema,
});
export type CheckoutQuoteRequest = z.infer<typeof CheckoutQuoteRequestSchema>;

export const CheckoutQuoteResponseSchema = z.object({
  product: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    image: z.object({ url: z.string(), alt: z.string() }).nullable(),
    unitPriceXaf: z.number().int(),
    moq: z.number().int(),
  }),
  quantity: z.number().int(),
  /** Vrai quand la quantité est sous le minimum du fournisseur : la commande sera refusée. */
  belowMinimumOrder: z.boolean(),
  fees: FeeBreakdownSchema,
});
export type CheckoutQuoteResponse = z.infer<typeof CheckoutQuoteResponseSchema>;

/** Création d'une commande et déclenchement immédiat du paiement (ORD-02, §23). */
export const CreateOrderRequestSchema = z.object({
  productSlug: z.string().trim().min(1, 'Choisissez un produit.'),
  quantity: QuantitySchema,
  city: CitySchema,
  deliveryMode: DeliveryModeSchema,
  phone: CameroonPhoneSchema,
  paymentMethod: CheckoutPaymentMethodSchema,
  /** Numéro Mobile Money à débiter, s'il diffère du numéro de contact. */
  payerPhone: CameroonPhoneSchema.optional(),
});
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

export const CreateOrderResponseSchema = z.object({
  order: OrderDetailSchema,
  payment: PaymentSummarySchema,
});
export type CreateOrderResponse = z.infer<typeof CreateOrderResponseSchema>;

// ───────────────────────── Précommandes (§22) ─────────────────────────

export const FaqEntrySchema = z.object({
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
});
export type FaqEntry = z.infer<typeof FaqEntrySchema>;

/** Progression d'une campagne : uniquement des participations payées, jamais un compteur décoratif. */
export const CampaignProgressSchema = z.object({
  minimumQuantity: z.number().int(),
  /** Quantité cumulée des participations dont le paiement est confirmé. */
  committedQuantity: z.number().int(),
  /** Nombre de participants distincts ayant payé. */
  participantCount: z.number().int(),
  /** Entre 0 et 100, plafonné. */
  percent: z.number().int(),
  reached: z.boolean(),
  provenance: z.literal('VERIFIED'),
});
export type CampaignProgress = z.infer<typeof CampaignProgressSchema>;

export const PreorderCampaignSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  status: PreorderCampaignStatusSchema,
  statusLabel: z.string(),
  image: z.object({ url: z.string(), alt: z.string() }).nullable(),
  unitPriceXaf: z.number().int(),
  endsAt: z.iso.datetime(),
  /** Vrai quand la campagne accepte encore des participations (ouverte et non échue). */
  acceptsParticipation: z.boolean(),
  progress: CampaignProgressSchema,
});
export type PreorderCampaignSummary = z.infer<typeof PreorderCampaignSummarySchema>;

export const PreorderCampaignDetailSchema = PreorderCampaignSummarySchema.extend({
  description: z.string(),
  productSlug: z.string().nullable(),
  included: z.array(z.string()),
  excluded: z.array(z.string()),
  leadTime: z.string(),
  conditions: z.string(),
  faq: z.array(FaqEntrySchema),
  updatedAt: z.iso.datetime(),
});
export type PreorderCampaignDetail = z.infer<typeof PreorderCampaignDetailSchema>;

export const PreorderCampaignListResponseSchema = z.object({
  campaigns: z.array(PreorderCampaignSummarySchema),
});
export type PreorderCampaignListResponse = z.infer<typeof PreorderCampaignListResponseSchema>;

export const PreorderCampaignResponseSchema = z.object({ campaign: PreorderCampaignDetailSchema });
export type PreorderCampaignResponse = z.infer<typeof PreorderCampaignResponseSchema>;

/** Création ou mise à jour d'une campagne (administration). */
export const CreatePreorderCampaignRequestSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Le libellé d’URL ne contient que des minuscules, chiffres et tirets.'),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10),
  status: PreorderCampaignStatusSchema.default('DRAFT'),
  imageUrl: z.url().optional(),
  imageAlt: z.string().trim().min(1).optional(),
  productId: z.string().optional(),
  unitPriceXaf: z.number().int().min(PAYMENT_MINIMUM_XAF),
  minimumQuantity: z.number().int().positive(),
  endsAt: z.coerce.date(),
  included: z.array(z.string().trim().min(1)).default([]),
  excluded: z.array(z.string().trim().min(1)).default([]),
  leadTime: z.string().trim().min(3),
  conditions: z.string().trim().min(3),
  faq: z.array(FaqEntrySchema).default([]),
});
export type CreatePreorderCampaignRequest = z.infer<typeof CreatePreorderCampaignRequestSchema>;

export const UpdatePreorderCampaignRequestSchema = CreatePreorderCampaignRequestSchema.partial();
export type UpdatePreorderCampaignRequest = z.infer<typeof UpdatePreorderCampaignRequestSchema>;

/** Participation : une commande de type PREORDER, payée tout de suite. */
export const ParticipatePreorderRequestSchema = z.object({
  quantity: QuantitySchema,
  city: CitySchema,
  deliveryMode: DeliveryModeSchema,
  phone: CameroonPhoneSchema,
  paymentMethod: CheckoutPaymentMethodSchema,
  payerPhone: CameroonPhoneSchema.optional(),
});
export type ParticipatePreorderRequest = z.infer<typeof ParticipatePreorderRequestSchema>;
