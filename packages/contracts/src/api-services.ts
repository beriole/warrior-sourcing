import { z } from 'zod';
import {
  CameroonPhoneSchema,
  CheckoutPaymentMethodSchema,
  PAYMENT_MINIMUM_XAF,
  PaymentSummarySchema,
} from './api-orders.js';

/**
 * Prestations et commandes de prestation (lot SRV, §29).
 *
 * Schémas de requête et de réponse de ce lot. Les décrire ici permet au serveur de typer
 * ses contrôleurs et au client du site d'être généré à partir du même contrat.
 * Ne rien écrire ici qui appartienne à un autre lot.
 *
 * Règles respectées (§54) :
 * - les prix sont des entiers en FCFA (1 FCFA = 1 unité), jamais de flottant ;
 * - aucun chiffre inventé : une prestation sans délai annoncé porte `leadTimeDays = null`
 *   et l'interface affiche « délai non communiqué », pas une estimation ;
 * - une prestation sans tarif public est `QUOTE` (sur devis) : son prix vaut `null`,
 *   elle n'est pas commandable en ligne et le serveur refuse de la facturer ;
 * - le paiement n'est pas réécrit ici : il passe par le lot PAY, dont le résumé
 *   (`PaymentSummarySchema`) est réutilisé tel quel.
 */

// ───────────────────────── Énumérations (jumelles de services.prisma) ─────────────────────────

/**
 * Les dix prestations du catalogue (§29). L'ordre est celui du cahier des charges :
 * il suit le parcours d'une importation, de la recherche du fournisseur à l'accompagnement.
 */
export const SERVICE_CATEGORIES = [
  'SUPPLIER_SEARCH',
  'VERIFICATION',
  'INSPECTION',
  'NEGOTIATION',
  'ASSISTED_PURCHASE',
  'SUPPLIER_PAYMENT',
  'CONSOLIDATION',
  'SHIPPING',
  'BRANDING',
  'COACHING',
] as const;
export const ServiceCategorySchema = z.enum(SERVICE_CATEGORIES);
export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, { label: string; description: string }> = {
  SUPPLIER_SEARCH: {
    label: 'Recherche de fournisseur',
    description: 'Nous cherchons des fournisseurs pour un produit précis et vous remettons une liste comparée.',
  },
  VERIFICATION: {
    label: 'Vérification de fournisseur',
    description: 'Contrôle de l’existence légale, de l’activité réelle et des documents d’un fournisseur.',
  },
  INSPECTION: {
    label: 'Inspection de marchandise',
    description: 'Contrôle de la marchandise avant expédition : quantité, conformité, état, emballage.',
  },
  NEGOTIATION: {
    label: 'Négociation',
    description: 'Nous négocions le prix, la quantité minimale et les conditions à votre place, en chinois.',
  },
  ASSISTED_PURCHASE: {
    label: 'Achat assisté',
    description: 'Nous passons la commande avec vous, du devis à la confirmation de production.',
  },
  SUPPLIER_PAYMENT: {
    label: 'Paiement fournisseur',
    description: 'Nous réglons le fournisseur en Chine depuis votre paiement en FCFA.',
  },
  CONSOLIDATION: {
    label: 'Consolidation',
    description: 'Regroupement de plusieurs achats dans un même colis avant expédition.',
  },
  SHIPPING: {
    label: 'Transport',
    description: 'Organisation de l’acheminement jusqu’au Cameroun et des formalités d’arrivée.',
  },
  BRANDING: {
    label: 'Branding et personnalisation',
    description: 'Logo, emballage et personnalisation du produit chez le fournisseur.',
  },
  COACHING: {
    label: 'Accompagnement',
    description: 'Un interlocuteur vous suit sur la durée, de la sélection du produit à la vente.',
  },
};

/**
 * Nature du tarif affiché. `FIXED` : le prix annoncé est le prix payé.
 * `FROM` : le prix annoncé est un plancher, le complément est confirmé avant exécution.
 * `QUOTE` : aucun tarif public, la prestation se chiffre après étude. Jamais d'estimation
 * inventée pour combler un tarif manquant (§54).
 */
export const SERVICE_PRICING_MODES = ['FIXED', 'FROM', 'QUOTE'] as const;
export const ServicePricingModeSchema = z.enum(SERVICE_PRICING_MODES);
export type ServicePricingMode = z.infer<typeof ServicePricingModeSchema>;

export const SERVICE_PRICING_MODE_LABELS: Record<ServicePricingMode, string> = {
  FIXED: 'Prix fixe',
  FROM: 'À partir de',
  QUOTE: 'Sur devis',
};

/** Cycle de vie d'une commande de prestation (SRV-02). */
export const SERVICE_ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'IN_PROGRESS',
  'AWAITING_CLIENT',
  'DELIVERED',
  'CANCELLED',
] as const;
export const ServiceOrderStatusSchema = z.enum(SERVICE_ORDER_STATUSES);
export type ServiceOrderStatus = z.infer<typeof ServiceOrderStatusSchema>;

export const SERVICE_ORDER_STATUS_LABELS: Record<ServiceOrderStatus, { label: string; description: string }> = {
  PENDING_PAYMENT: {
    label: 'En attente de paiement',
    description: 'La demande est enregistrée. Elle démarre dès que le paiement est confirmé.',
  },
  PAID: {
    label: 'Payée',
    description: 'Paiement reçu. Un intervenant prend la demande en charge.',
  },
  IN_PROGRESS: {
    label: 'En cours',
    description: 'La prestation est en cours d’exécution.',
  },
  AWAITING_CLIENT: {
    label: 'En attente de votre réponse',
    description: 'Nous avons besoin d’une précision de votre part pour continuer.',
  },
  DELIVERED: {
    label: 'Livrée',
    description: 'Les livrables sont disponibles.',
  },
  CANCELLED: {
    label: 'Annulée',
    description: 'La demande a été annulée. Aucune exécution n’est en cours.',
  },
};

/**
 * Machine à états stricte : toute transition non listée est refusée côté serveur.
 * `PAID` n'est jamais écrit par l'interface : seule la confirmation du paiement (lot PAY) l'écrit.
 */
export const SERVICE_ORDER_TRANSITIONS: Record<ServiceOrderStatus, readonly ServiceOrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['AWAITING_CLIENT', 'DELIVERED', 'CANCELLED'],
  AWAITING_CLIENT: ['IN_PROGRESS', 'DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionServiceOrder(from: ServiceOrderStatus, to: ServiceOrderStatus): boolean {
  return SERVICE_ORDER_TRANSITIONS[from].includes(to);
}

export function isFinalServiceOrderStatus(status: ServiceOrderStatus): boolean {
  return SERVICE_ORDER_TRANSITIONS[status].length === 0;
}

/**
 * Étapes de suivi présentées au client, dans l'ordre. `AWAITING_CLIENT` et `CANCELLED`
 * n'en font pas partie : ce ne sont pas des avancées, ce sont des interruptions.
 */
export const SERVICE_ORDER_STEPS = ['PENDING_PAYMENT', 'PAID', 'IN_PROGRESS', 'DELIVERED'] as const;

/**
 * Avancement d'une commande de prestation, en pourcentage entier.
 * Une commande annulée vaut 0 : elle n'a pas avancé, elle s'est arrêtée.
 * `AWAITING_CLIENT` reste à la hauteur de `IN_PROGRESS` : l'attente ne fait pas reculer.
 */
export function serviceOrderProgressPercent(status: ServiceOrderStatus): number {
  if (status === 'CANCELLED') return 0;
  const effective = status === 'AWAITING_CLIENT' ? 'IN_PROGRESS' : status;
  const index = SERVICE_ORDER_STEPS.indexOf(effective as (typeof SERVICE_ORDER_STEPS)[number]);
  if (index < 0) return 0;
  return Math.round(((index + 1) / SERVICE_ORDER_STEPS.length) * 100);
}

// ───────────────────────── Règles d'affichage ─────────────────────────

/** Texte affiché quand aucun délai n'a été annoncé. Jamais remplacé par une estimation (§54). */
export const LEAD_TIME_UNKNOWN = 'Délai non communiqué';

/**
 * Délai lisible : « 3 jours ouvrés », « 1 jour ouvré », ou l'absence de délai annoncée telle quelle.
 * Le délai est toujours exprimé en jours ouvrés : c'est ainsi qu'il est saisi.
 */
export function formatLeadTime(days: number | null): string {
  if (days === null || days <= 0) return LEAD_TIME_UNKNOWN;
  return days === 1 ? '1 jour ouvré' : `${days} jours ouvrés`;
}

/** Vrai quand la prestation a un tarif public et peut donc être commandée et payée en ligne. */
export function isServiceOrderable(service: { pricingMode: ServicePricingMode; priceXaf: number | null }): boolean {
  return service.pricingMode !== 'QUOTE' && service.priceXaf !== null && service.priceXaf >= PAYMENT_MINIMUM_XAF;
}

/** Pourquoi une prestation n'est pas commandable en ligne, `null` quand elle l'est. */
export function serviceNotOrderableReason(service: {
  pricingMode: ServicePricingMode;
  priceXaf: number | null;
}): string | null {
  if (service.pricingMode === 'QUOTE' || service.priceXaf === null) {
    return 'Cette prestation se chiffre après étude de votre besoin : elle ne se paie pas en ligne.';
  }
  if (service.priceXaf < PAYMENT_MINIMUM_XAF) {
    return `Le montant minimum d’un paiement est de ${PAYMENT_MINIMUM_XAF} FCFA.`;
  }
  return null;
}

// ───────────────────────── Requêtes ─────────────────────────

export const ServiceCatalogQuerySchema = z.object({
  category: ServiceCategorySchema.optional(),
  /** Recherche libre sur le nom et le résumé. */
  search: z.string().trim().min(1).max(100).optional(),
  /** Ne garde que les prestations dont le tarif public ne dépasse pas ce montant, en FCFA. */
  maxPriceXaf: z.coerce.number().int().positive().optional(),
  /**
   * « true » pour ne garder que les prestations commandables en ligne.
   * Écrit à la main plutôt qu'avec `z.coerce.boolean()` : celui-ci rendrait `true`
   * pour la chaîne « false », ce qui inverserait silencieusement le filtre.
   */
  orderableOnly: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(48).default(12),
});
export type ServiceCatalogQuery = z.infer<typeof ServiceCatalogQuerySchema>;

/** Historique des commandes de prestation du client connecté. */
export const ServiceOrderQuerySchema = z.object({
  status: ServiceOrderStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(48).default(12),
});
export type ServiceOrderQuery = z.infer<typeof ServiceOrderQuerySchema>;

/**
 * Commande d'une prestation (SRV-02). Le montant n'est pas envoyé par le client :
 * le serveur le reprend du catalogue. Le besoin (`brief`) est obligatoire : sans lui,
 * la prestation ne peut pas démarrer.
 */
export const CreateServiceOrderRequestSchema = z.object({
  serviceSlug: z.string().min(1).max(120),
  /** Ce que le client attend, en ses mots. Minimum 20 caractères : une ligne vide ne suffit pas. */
  brief: z.string().trim().min(20).max(4_000),
  /** Ville de contact au Cameroun. */
  city: z.string().trim().min(2).max(80),
  contactPhone: CameroonPhoneSchema,
  /** Quantité visée, quand la prestation porte sur un achat. */
  quantity: z.number().int().positive().max(1_000_000).optional(),
  /** Budget visé en FCFA entiers, quand le client en a un. */
  budgetXaf: z.number().int().positive().optional(),
  /** Liens utiles : fiche produit, boutique du fournisseur, photo. Cinq au plus. */
  links: z.array(z.url().max(500)).max(5).default([]),
  paymentMethod: CheckoutPaymentMethodSchema,
  /** Numéro sur lequel pousser la demande de paiement, si différent du contact. */
  payerPhone: CameroonPhoneSchema.optional(),
});
export type CreateServiceOrderRequest = z.infer<typeof CreateServiceOrderRequestSchema>;

/** Relance du paiement d'une commande de prestation restée impayée. */
export const RetryServiceOrderPaymentRequestSchema = z.object({
  paymentMethod: CheckoutPaymentMethodSchema,
  payerPhone: CameroonPhoneSchema.optional(),
});
export type RetryServiceOrderPaymentRequest = z.infer<typeof RetryServiceOrderPaymentRequestSchema>;

/**
 * Avancement d'une commande par l'équipe (suivi d'exécution). Réservé au personnel :
 * le client ne décide pas de l'état de sa prestation.
 */
export const AdvanceServiceOrderRequestSchema = z.object({
  status: ServiceOrderStatusSchema,
  /** Ce qui vient d'être fait, en une phrase lisible par le client. */
  note: z.string().trim().min(3).max(1_000).optional(),
});
export type AdvanceServiceOrderRequest = z.infer<typeof AdvanceServiceOrderRequestSchema>;

/** Dépôt d'un livrable sur une commande de prestation. Réservé au personnel. */
export const AddServiceDeliverableRequestSchema = z.object({
  title: z.string().trim().min(3).max(200),
  /** Extension du fichier, telle qu'elle a été déposée (pdf, xlsx, jpg…). */
  fileFormat: z.string().trim().min(1).max(10),
  url: z.url().max(1_000),
  sizeBytes: z.number().int().positive().optional(),
  note: z.string().trim().max(1_000).optional(),
});
export type AddServiceDeliverableRequest = z.infer<typeof AddServiceDeliverableRequestSchema>;

// ───────────────────────── Briques de réponse ─────────────────────────

export const ServiceCardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  summary: z.string(),
  category: ServiceCategorySchema,
  categoryLabel: z.string(),
  pricingMode: ServicePricingModeSchema,
  pricingModeLabel: z.string(),
  /** Tarif public en FCFA entiers. `null` pour une prestation sur devis. */
  priceXaf: z.number().int().nullable(),
  /** Délai annoncé en jours ouvrés. `null` quand il n'a pas été communiqué. */
  leadTimeDays: z.number().int().nullable(),
  /** Délai déjà rédigé : « 3 jours ouvrés » ou « Délai non communiqué ». */
  leadTimeLabel: z.string(),
  /** Vrai quand la prestation peut être commandée et payée en ligne : décidé côté serveur. */
  orderable: z.boolean(),
  notOrderableReason: z.string().nullable(),
  publishedAt: z.iso.datetime(),
});
export type ServiceCard = z.infer<typeof ServiceCardSchema>;

export const ServiceDetailSchema = ServiceCardSchema.extend({
  description: z.string(),
  /** Ce que le client reçoit à la fin. Jamais vide : une prestation sans livrable n'est pas publiée. */
  deliverables: z.array(z.string()),
  /** Ce qui encadre la prestation : ce qu'elle couvre, ce qu'elle ne couvre pas. */
  conditions: z.array(z.string()),
  /** Ce que le client doit fournir pour que la prestation démarre. */
  requirements: z.array(z.string()),
  /** Précision libre sur le délai, quand l'équipe en a écrit une. */
  leadTimeNote: z.string().nullable(),
});
export type ServiceDetail = z.infer<typeof ServiceDetailSchema>;

/** Une étape du suivi d'exécution, telle qu'elle est servie au client. */
export const ServiceOrderEventSchema = z.object({
  id: z.string(),
  status: ServiceOrderStatusSchema,
  statusLabel: z.string(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type ServiceOrderEvent = z.infer<typeof ServiceOrderEventSchema>;

/** Un livrable remis au client. Servi seulement sur une commande payée. */
export const ServiceDeliverableSchema = z.object({
  id: z.string(),
  title: z.string(),
  fileFormat: z.string(),
  sizeBytes: z.number().int().nullable(),
  url: z.string(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type ServiceDeliverable = z.infer<typeof ServiceDeliverableSchema>;

export const ServiceOrderSummarySchema = z.object({
  reference: z.string(),
  status: ServiceOrderStatusSchema,
  statusLabel: z.string(),
  statusDescription: z.string(),
  /** Avancement calculé côté serveur à partir de l'état, jamais côté client. */
  progressPercent: z.number().int().min(0).max(100),
  serviceSlug: z.string(),
  serviceName: z.string(),
  category: ServiceCategorySchema,
  categoryLabel: z.string(),
  /** Montant figé à la commande, en FCFA entiers. */
  amountXaf: z.number().int(),
  /** Délai annoncé au moment de la commande, `null` s'il n'y en avait pas. */
  leadTimeDays: z.number().int().nullable(),
  leadTimeLabel: z.string(),
  deliverableCount: z.number().int(),
  createdAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
});
export type ServiceOrderSummary = z.infer<typeof ServiceOrderSummarySchema>;

export const ServiceOrderDetailSchema = ServiceOrderSummarySchema.extend({
  brief: z.string(),
  city: z.string(),
  contactPhone: z.string(),
  quantity: z.number().int().nullable(),
  budgetXaf: z.number().int().nullable(),
  links: z.array(z.string()),
  /** Ce que couvrait la prestation, figé à la commande : la fiche peut changer ensuite. */
  orderedDeliverables: z.array(z.string()),
  events: z.array(ServiceOrderEventSchema),
  /** Livrables remis. Liste vide tant que la commande n'est pas payée. */
  deliverables: z.array(ServiceDeliverableSchema),
  /** Dernier paiement connu, `null` quand aucun n'a été lancé. */
  payment: PaymentSummarySchema.nullable(),
});
export type ServiceOrderDetail = z.infer<typeof ServiceOrderDetailSchema>;

// ───────────────────────── Réponses ─────────────────────────

export const ServiceCatalogResponseSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  items: z.array(ServiceCardSchema),
  /** Catégories réellement présentes au catalogue, avec leur nombre de prestations. */
  categories: z.array(
    z.object({ category: ServiceCategorySchema, label: z.string(), count: z.number().int() }),
  ),
});
export type ServiceCatalogResponse = z.infer<typeof ServiceCatalogResponseSchema>;

export const ServiceDetailResponseSchema = z.object({ service: ServiceDetailSchema });
export type ServiceDetailResponse = z.infer<typeof ServiceDetailResponseSchema>;

export const ServiceOrderResponseSchema = z.object({ order: ServiceOrderDetailSchema });
export type ServiceOrderResponse = z.infer<typeof ServiceOrderResponseSchema>;

export const CreateServiceOrderResponseSchema = z.object({
  order: ServiceOrderDetailSchema,
  payment: PaymentSummarySchema,
});
export type CreateServiceOrderResponse = z.infer<typeof CreateServiceOrderResponseSchema>;

export const ServiceOrderListResponseSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  items: z.array(ServiceOrderSummarySchema),
});
export type ServiceOrderListResponse = z.infer<typeof ServiceOrderListResponseSchema>;
