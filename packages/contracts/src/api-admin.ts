import { z } from 'zod';
import {
  CourseAccessSchema,
  CourseLevelSchema,
  CourseThemeSchema,
  ResourceTypeSchema,
} from './api-academy.js';
import {
  MarketLevelSchema,
  ProductBadgeSchema,
  RiskLevelSchema,
  TransportEaseSchema,
} from './api-catalog.js';
import { OrderKindSchema, OrderStatusSchema, DeliveryModeSchema } from './api-orders.js';
import { CurrencySchema } from './money.js';
import { InterestCategorySchema } from './onboarding.js';
import { PaymentMethodSchema, PaymentStatusSchema } from './payment.js';
import { DataProvenanceSchema } from './provenance.js';
import { UserRoleSchema } from './roles.js';
import { SupplierTypeSchema, SupplierVerificationLevelSchema } from './supplier.js';
import { SupplierPhotoKindSchema, SupplierShopPlatformSchema } from './api-suppliers.js';
import { ShipmentStageSchema } from './logistics.js';

/**
 * Indicateurs, gestion et litiges du back-office (lot ADM).
 *
 * Schémas de requête et de réponse de ce lot. Les décrire ici permet au serveur de typer
 * ses contrôleurs et au client d'être généré à partir du même contrat.
 * Ne rien écrire ici qui appartienne à un autre lot.
 */

const xaf = z.number().int();

// ───────────────────────── Périodes d'observation (ADM-02) ─────────────────────────

/** Fenêtres proposées par le tableau de bord. « tout » ne borne pas la date de début. */
export const ADMIN_PERIODS = ['7j', '30j', 'tout'] as const;
export const AdminPeriodSchema = z.enum(ADMIN_PERIODS);
export type AdminPeriod = z.infer<typeof AdminPeriodSchema>;

export const ADMIN_PERIOD_LABELS: Record<AdminPeriod, string> = {
  '7j': '7 derniers jours',
  '30j': '30 derniers jours',
  tout: 'Depuis le début',
};

/** Nombre de jours couverts par une période, ou null quand elle n'est pas bornée. */
export const ADMIN_PERIOD_DAYS: Record<AdminPeriod, number | null> = {
  '7j': 7,
  '30j': 30,
  tout: null,
};

export const AdminStatsQuerySchema = z.object({
  periode: AdminPeriodSchema.default('30j'),
});
export type AdminStatsQuery = z.output<typeof AdminStatsQuerySchema>;

// ───────────────────────── Indicateurs (ADM-02) ─────────────────────────

/**
 * Tous les chiffres sont agrégés en SQL. Une période sans donnée vaut zéro :
 * aucune estimation, aucune extrapolation (§37, règle commune n°3).
 */
export const AdminStatsResponseSchema = z.object({
  /** Provenance : ces chiffres sont lus en base, jamais estimés. */
  provenance: z.literal('VERIFIED'),
  period: AdminPeriodSchema,
  /** Début de la fenêtre observée, null quand la période couvre tout l'historique. */
  since: z.iso.datetime().nullable(),
  computedAt: z.iso.datetime(),

  revenue: z.object({
    /** Encaissements confirmés sur la période, remboursements déduits. */
    netXaf: xaf,
    grossXaf: xaf,
    refundedXaf: xaf,
    /** Nombre de paiements encaissés ayant servi à ce total. */
    paymentCount: z.number().int(),
  }),

  orders: z.object({
    total: z.number().int(),
    pendingPayment: z.number().int(),
    paid: z.number().int(),
    cancelled: z.number().int(),
    /** Somme des totaux des commandes payées sur la période. */
    paidAmountXaf: xaf,
  }),

  customers: z.object({
    /** Comptes créés sur la période. */
    newAccounts: z.number().int(),
    /** Comptes ayant passé au moins une commande sur la période. */
    activeBuyers: z.number().int(),
    /** Total des comptes clients, toutes périodes confondues. */
    totalAccounts: z.number().int(),
  }),

  payments: z.object({
    /** Un état par valeur de l'énumération, à zéro quand il n'y a rien. */
    byStatus: z.array(
      z.object({
        status: PaymentStatusSchema,
        count: z.number().int(),
        amountXaf: xaf,
      }),
    ),
  }),

  preorders: z.object({
    /** Participations enregistrées sur la période. */
    participations: z.number().int(),
    participationAmountXaf: xaf,
    /** Campagnes ouvertes à la date du calcul. */
    openCampaigns: z.number().int(),
  }),
});
export type AdminStatsResponse = z.infer<typeof AdminStatsResponseSchema>;

// ───────────────────────── Journal d'audit (ADM-01, PLAT-05) ─────────────────────────

export const AuditEntryResponseSchema = z.object({
  id: z.string(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string().nullable(),
  /** Nom de l'auteur quand le compte existe encore, sinon null. */
  actorName: z.string().nullable(),
  actorId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
});
export type AuditEntryResponse = z.infer<typeof AuditEntryResponseSchema>;

export const AuditListResponseSchema = z.object({
  entries: z.array(AuditEntryResponseSchema),
  total: z.number().int(),
});
export type AuditListResponse = z.infer<typeof AuditListResponseSchema>;

/** Tableau de bord d'administration : indicateurs de la période et dernières actions sensibles. */
export const AdminDashboardResponseSchema = z.object({
  stats: AdminStatsResponseSchema,
  audit: AuditListResponseSchema,
});
export type AdminDashboardResponse = z.infer<typeof AdminDashboardResponseSchema>;

// ───────────────────────── Utilisateurs et rôles (ADM-07) ─────────────────────────

export const AdminUserSearchQuerySchema = z.object({
  recherche: z.string().trim().max(120).optional(),
  role: UserRoleSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  taille: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminUserSearchQuery = z.output<typeof AdminUserSearchQuerySchema>;

export const AdminUserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phoneNumber: z.string().nullable(),
  role: UserRoleSchema,
  emailVerified: z.boolean(),
  orderCount: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type AdminUserResponse = z.infer<typeof AdminUserResponseSchema>;

export const AdminUserListResponseSchema = z.object({
  users: z.array(AdminUserResponseSchema),
  total: z.number().int(),
  page: z.number().int(),
  taille: z.number().int(),
});
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>;

/**
 * Changement de rôle : réservé au SUPER_ADMIN et systématiquement journalisé.
 * Le motif est obligatoire pour que le journal d'audit reste lisible des mois plus tard.
 */
export const UpdateUserRoleRequestSchema = z.object({
  role: UserRoleSchema,
  reason: z.string().trim().min(3, 'Indiquez le motif du changement de rôle.').max(300),
});
export type UpdateUserRoleRequest = z.input<typeof UpdateUserRoleRequestSchema>;

export const UpdateUserRoleResponseSchema = z.object({
  user: AdminUserResponseSchema,
  previousRole: UserRoleSchema,
});
export type UpdateUserRoleResponse = z.infer<typeof UpdateUserRoleResponseSchema>;

// ───────────────────────── Commandes (ADM-06) ─────────────────────────

export const AdminOrderSearchQuerySchema = z.object({
  statut: OrderStatusSchema.optional(),
  genre: OrderKindSchema.optional(),
  recherche: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  taille: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminOrderSearchQuery = z.output<typeof AdminOrderSearchQuerySchema>;

export const AdminOrderResponseSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: OrderStatusSchema,
  kind: OrderKindSchema,
  stage: ShipmentStageSchema,
  totalXaf: xaf,
  city: z.string(),
  deliveryMode: DeliveryModeSchema,
  customerName: z.string(),
  customerEmail: z.string(),
  lineCount: z.number().int(),
  createdAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
});
export type AdminOrderResponse = z.infer<typeof AdminOrderResponseSchema>;

export const AdminOrderListResponseSchema = z.object({
  orders: z.array(AdminOrderResponseSchema),
  total: z.number().int(),
  page: z.number().int(),
  taille: z.number().int(),
});
export type AdminOrderListResponse = z.infer<typeof AdminOrderListResponseSchema>;

export const AdminOrderDetailResponseSchema = z.object({
  order: AdminOrderResponseSchema,
  amounts: z.object({
    subtotalXaf: xaf,
    freightXaf: xaf,
    serviceFeeXaf: xaf,
    customsXaf: xaf,
    totalXaf: xaf,
  }),
  phone: z.string(),
  lines: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      quantity: z.number().int(),
      unitPriceXaf: xaf,
      lineTotalXaf: xaf,
    }),
  ),
  payments: z.array(
    z.object({
      id: z.string(),
      reference: z.string(),
      method: PaymentMethodSchema,
      status: PaymentStatusSchema,
      amountXaf: xaf,
      refundedXaf: xaf,
      createdAt: z.iso.datetime(),
    }),
  ),
  /** États atteignables depuis l'état courant, calculés côté serveur. */
  allowedStatuses: z.array(OrderStatusSchema),
});
export type AdminOrderDetailResponse = z.infer<typeof AdminOrderDetailResponseSchema>;

/**
 * Changement d'état d'une commande. Toute transition non listée ci-dessous est refusée
 * côté serveur : une commande annulée ne se rouvre pas, une commande payée ne redevient
 * pas « en attente de paiement ».
 */
export const ORDER_STATUS_TRANSITIONS: Record<
  z.infer<typeof OrderStatusSchema>,
  readonly z.infer<typeof OrderStatusSchema>[]
> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['CANCELLED'],
  CANCELLED: [],
};

export function canTransitionOrder(
  from: z.infer<typeof OrderStatusSchema>,
  to: z.infer<typeof OrderStatusSchema>,
): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export const UpdateOrderStatusRequestSchema = z.object({
  status: OrderStatusSchema,
  reason: z.string().trim().min(3, 'Indiquez le motif du changement d’état.').max(300),
});
export type UpdateOrderStatusRequest = z.input<typeof UpdateOrderStatusRequestSchema>;

// ───────────────────────── Litiges (ADM-08, §39) ─────────────────────────

/**
 * Cahier §39 : un litige suit sept étapes, dans l'ordre. Aucun raccourci n'est possible,
 * ni côté interface ni côté serveur.
 */
export const DISPUTE_STATUSES = [
  'OPENED',
  'ANALYSIS',
  'EVIDENCE',
  'SUPPLIER_CONTACTED',
  'PROPOSAL',
  'RESOLVED',
  'CLOSED',
] as const;
export const DisputeStatusSchema = z.enum(DISPUTE_STATUSES);
export type DisputeStatus = z.infer<typeof DisputeStatusSchema>;

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPENED: 'Ouverture',
  ANALYSIS: 'Analyse',
  EVIDENCE: 'Collecte des preuves',
  SUPPLIER_CONTACTED: 'Fournisseur contacté',
  PROPOSAL: 'Proposition faite',
  RESOLVED: 'Résolu',
  CLOSED: 'Clôturé',
};

export const DISPUTE_STATUS_DESCRIPTIONS: Record<DisputeStatus, string> = {
  OPENED: 'Le litige est déclaré et rattaché à une commande.',
  ANALYSIS: 'Les faits sont instruits et qualifiés.',
  EVIDENCE: 'Photos, documents et échanges sont réunis.',
  SUPPLIER_CONTACTED: 'Le fournisseur a été saisi du dossier.',
  PROPOSAL: 'Une solution chiffrée a été proposée au client.',
  RESOLVED: 'La solution a été appliquée et acceptée.',
  CLOSED: 'Le dossier est clos, plus aucune action n’est possible.',
};

/** Le workflow est strictement séquentiel : chaque étape n'ouvre que la suivante. */
export const DISPUTE_TRANSITIONS: Record<DisputeStatus, readonly DisputeStatus[]> = {
  OPENED: ['ANALYSIS'],
  ANALYSIS: ['EVIDENCE'],
  EVIDENCE: ['SUPPLIER_CONTACTED'],
  SUPPLIER_CONTACTED: ['PROPOSAL'],
  PROPOSAL: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export function canTransitionDispute(from: DisputeStatus, to: DisputeStatus): boolean {
  return DISPUTE_TRANSITIONS[from].includes(to);
}

export function isFinalDisputeStatus(status: DisputeStatus): boolean {
  return DISPUTE_TRANSITIONS[status].length === 0;
}

/** Rang de l'étape dans le workflow, pour afficher une progression honnête. */
export function disputeStepIndex(status: DisputeStatus): number {
  return DISPUTE_STATUSES.indexOf(status);
}

export const DISPUTE_CATEGORIES = [
  'NON_CONFORME',
  'QUANTITE_MANQUANTE',
  'CASSE',
  'RETARD',
  'NON_LIVRE',
  'AUTRE',
] as const;
export const DisputeCategorySchema = z.enum(DISPUTE_CATEGORIES);
export type DisputeCategory = z.infer<typeof DisputeCategorySchema>;

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  NON_CONFORME: 'Marchandise non conforme',
  QUANTITE_MANQUANTE: 'Quantité manquante',
  CASSE: 'Casse ou dégât',
  RETARD: 'Retard de livraison',
  NON_LIVRE: 'Colis non livré',
  AUTRE: 'Autre motif',
};

export const CreateDisputeRequestSchema = z.object({
  orderId: z.string().min(1, 'Rattachez le litige à une commande.'),
  category: DisputeCategorySchema,
  subject: z.string().trim().min(3, 'Résumez le litige en quelques mots.').max(160),
  description: z.string().trim().min(10, 'Décrivez les faits.').max(4_000),
  /** Montant contesté, en FCFA entiers. Zéro quand il n'est pas encore chiffré. */
  claimedAmountXaf: z.number().int().nonnegative().default(0),
});
export type CreateDisputeRequest = z.input<typeof CreateDisputeRequestSchema>;

/**
 * Passage à l'étape suivante. La note est obligatoire : c'est elle qui documente
 * ce qui a été fait, et elle est conservée dans le journal du litige.
 */
export const AdvanceDisputeRequestSchema = z.object({
  status: DisputeStatusSchema,
  note: z.string().trim().min(3, 'Décrivez ce qui a été fait à cette étape.').max(2_000),
  /** Lien vers une preuve (photo, document, échange) quand l'étape en produit une. */
  evidenceUrl: z.url('Lien invalide.').optional(),
  /** Montant finalement accordé au client, renseigné au moment de la résolution. */
  resolvedAmountXaf: z.number().int().nonnegative().optional(),
});
export type AdvanceDisputeRequest = z.input<typeof AdvanceDisputeRequestSchema>;

export const DisputeEventResponseSchema = z.object({
  id: z.string(),
  fromStatus: DisputeStatusSchema.nullable(),
  toStatus: DisputeStatusSchema,
  note: z.string(),
  evidenceUrl: z.string().nullable(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type DisputeEventResponse = z.infer<typeof DisputeEventResponseSchema>;

export const DisputeResponseSchema = z.object({
  id: z.string(),
  reference: z.string(),
  orderId: z.string(),
  orderReference: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  category: DisputeCategorySchema,
  status: DisputeStatusSchema,
  subject: z.string(),
  description: z.string(),
  claimedAmountXaf: xaf,
  resolvedAmountXaf: xaf.nullable(),
  openedById: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
});
export type DisputeResponse = z.infer<typeof DisputeResponseSchema>;

export const DisputeSearchQuerySchema = z.object({
  statut: DisputeStatusSchema.optional(),
  recherche: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  taille: z.coerce.number().int().min(1).max(100).default(25),
});
export type DisputeSearchQuery = z.output<typeof DisputeSearchQuerySchema>;

export const DisputeListResponseSchema = z.object({
  disputes: z.array(DisputeResponseSchema),
  total: z.number().int(),
  page: z.number().int(),
  taille: z.number().int(),
  /** Nombre de dossiers par étape, pour piloter la file d'attente. */
  byStatus: z.array(z.object({ status: DisputeStatusSchema, count: z.number().int() })),
});
export type DisputeListResponse = z.infer<typeof DisputeListResponseSchema>;

export const DisputeDetailResponseSchema = z.object({
  dispute: DisputeResponseSchema,
  events: z.array(DisputeEventResponseSchema),
  /** Étapes atteignables depuis l'étape courante, calculées côté serveur. */
  allowedStatuses: z.array(DisputeStatusSchema),
});
export type DisputeDetailResponse = z.infer<typeof DisputeDetailResponseSchema>;

/**
 * Libellés français des rôles (§40), utilisés par le back-office.
 * Les valeurs, elles, restent définies une seule fois dans `roles.ts`.
 */
export const USER_ROLE_LABELS: Record<z.infer<typeof UserRoleSchema>, string> = {
  CLIENT: 'Client',
  PREMIUM_MEMBER: 'Membre premium',
  TRAINER: 'Formateur',
  SOURCING_AGENT: 'Agent sourcing',
  CHINA_AGENT: 'Agent Chine',
  LOGISTICS_AGENT: 'Agent logistique',
  SUPPORT: 'Support',
  CONTENT_MANAGER: 'Responsable contenu',
  ADMIN: 'Administrateur',
  SUPER_ADMIN: 'Super-administrateur',
};

// ═════════════════════ Gestion des produits (ADM-03, §12, §13) ═════════════════════

/**
 * Un produit se crée en brouillon, se complète, puis se publie. La publication est une
 * décision : elle exige que les informations qui font foi soient présentes. Le serveur
 * refuse de publier une fiche incomplète plutôt que de laisser un trou visible au public.
 */
export const PRODUCT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export const ProductStatusSchema = z.enum(PRODUCT_STATUSES);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, { label: string; description: string }> = {
  DRAFT: { label: 'Brouillon', description: 'Visible de l’équipe seulement : la fiche se complète.' },
  PUBLISHED: { label: 'Publié', description: 'Visible au catalogue public.' },
  ARCHIVED: { label: 'Retiré', description: 'Retiré du catalogue, conservé pour l’historique.' },
};

export const AdminProductSearchQuerySchema = z.object({
  recherche: z.string().trim().min(1).max(100).optional(),
  status: ProductStatusSchema.optional(),
  category: InterestCategorySchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminProductSearchQuery = z.infer<typeof AdminProductSearchQuerySchema>;

/**
 * Relevé de marché d'un produit, tel que le back-office le voit.
 * Un prix local sans date ni source n'existe pas : voir `UpdateProductMarketRequestSchema`.
 */
export const AdminProductMarketSchema = z.object({
  localPriceMinXaf: xaf.nullable(),
  localPriceMaxXaf: xaf.nullable(),
  localPriceObservedAt: z.iso.datetime().nullable(),
  localPriceSource: z.string().nullable(),
  localPriceProvenance: DataProvenanceSchema,
  demand: MarketLevelSchema.nullable(),
  competition: MarketLevelSchema.nullable(),
  risk: RiskLevelSchema.nullable(),
  transportEase: TransportEaseSchema.nullable(),
  capitalRequiredXaf: xaf.nullable(),
  assessedAt: z.iso.datetime().nullable(),
  assessmentSource: z.string().nullable(),
  assessmentProvenance: DataProvenanceSchema,
});
export type AdminProductMarket = z.infer<typeof AdminProductMarketSchema>;

export const AdminProductResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  category: InterestCategorySchema,
  categoryLabel: z.string(),
  status: ProductStatusSchema,
  statusLabel: z.string(),
  /** Prix d'achat dans sa devise d'origine, en unités mineures. */
  purchasePriceMinor: z.number().int(),
  purchaseCurrency: CurrencySchema,
  /** Même prix converti en FCFA, avec le taux qui a servi. */
  purchasePriceXaf: xaf,
  exchangeRate: z.number(),
  exchangeRateAt: z.iso.datetime(),
  exchangeRateSource: z.string(),
  moq: z.number().int(),
  weightGrams: z.number().int(),
  volumeCm3: z.number().int().nullable(),
  badges: z.array(ProductBadgeSchema),
  watchPoints: z.array(z.string()),
  supplierIds: z.array(z.string()),
  imageCount: z.number().int(),
  publishedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  /**
   * Ce qui manque encore pour publier. Vide quand la fiche est publiable.
   * Calculé par le serveur : l'interface n'a pas à deviner la règle.
   */
  missingForPublication: z.array(z.string()),
});
export type AdminProductResponse = z.infer<typeof AdminProductResponseSchema>;

export const AdminProductListResponseSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  items: z.array(AdminProductResponseSchema),
  /** Nombre de fiches par état, pour piloter la file de publication. */
  byStatus: z.array(z.object({ status: ProductStatusSchema, count: z.number().int() })),
});
export type AdminProductListResponse = z.infer<typeof AdminProductListResponseSchema>;

export const AdminProductDetailResponseSchema = z.object({
  product: AdminProductResponseSchema,
  market: AdminProductMarketSchema.nullable(),
  images: z.array(
    z.object({ id: z.string(), url: z.string(), alt: z.string(), position: z.number().int() }),
  ),
});
export type AdminProductDetailResponse = z.infer<typeof AdminProductDetailResponseSchema>;

/**
 * Création d'une fiche. Le taux de change porte sa date et sa source : un prix converti
 * sans taux daté serait un chiffre orphelin, donc un chiffre qu'on ne peut pas défendre.
 */
export const CreateProductRequestSchema = z.object({
  name: z.string().trim().min(3).max(140),
  description: z.string().trim().min(20).max(4_000),
  category: InterestCategorySchema,
  purchasePriceMinor: z.number().int().positive(),
  purchaseCurrency: CurrencySchema.default('CNY'),
  exchangeRate: z.number().positive(),
  exchangeRateAt: z.iso.datetime(),
  exchangeRateSource: z.string().trim().min(3).max(140),
  moq: z.number().int().positive(),
  weightGrams: z.number().int().positive(),
  volumeCm3: z.number().int().positive().nullable().default(null),
  badges: z.array(ProductBadgeSchema).max(8).default([]),
  watchPoints: z.array(z.string().trim().min(3).max(300)).max(10).default([]),
  supplierIds: z.array(z.string().min(1)).max(20).default([]),
});
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;

/** Modification d'une fiche : tous les champs sont facultatifs, aucun n'est effacé par omission. */
export const UpdateProductRequestSchema = CreateProductRequestSchema.partial();
export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>;

/** Publication ou retrait. Le motif est obligatoire : il part au journal d'audit. */
export const UpdateProductStatusRequestSchema = z.object({
  status: ProductStatusSchema,
  reason: z.string().trim().min(5).max(300),
});
export type UpdateProductStatusRequest = z.infer<typeof UpdateProductStatusRequestSchema>;

/**
 * Relevé de marché. Règle de fond (§54) : un prix local n'est accepté qu'accompagné de sa
 * date de relevé et de sa source. Sans elles, l'interface publique affiche « pas encore
 * relevé », ce qui est honnête ; un prix sans origine ne le serait pas.
 */
export const UpdateProductMarketRequestSchema = z
  .object({
    localPriceMinXaf: xaf.nonnegative().nullable().default(null),
    localPriceMaxXaf: xaf.nonnegative().nullable().default(null),
    localPriceObservedAt: z.iso.datetime().nullable().default(null),
    localPriceSource: z.string().trim().min(3).max(200).nullable().default(null),
    localPriceProvenance: DataProvenanceSchema.default('VERIFIED'),
    demand: MarketLevelSchema.nullable().default(null),
    competition: MarketLevelSchema.nullable().default(null),
    risk: RiskLevelSchema.nullable().default(null),
    transportEase: TransportEaseSchema.nullable().default(null),
    capitalRequiredXaf: xaf.nonnegative().nullable().default(null),
    assessedAt: z.iso.datetime().nullable().default(null),
    assessmentSource: z.string().trim().min(3).max(200).nullable().default(null),
    assessmentProvenance: DataProvenanceSchema.default('ESTIMATE'),
  })
  .superRefine((value, ctx) => {
    const aUnPrix = value.localPriceMinXaf !== null || value.localPriceMaxXaf !== null;
    if (aUnPrix && !value.localPriceObservedAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['localPriceObservedAt'],
        message: 'Un prix local doit porter la date à laquelle il a été relevé.',
      });
    }
    if (aUnPrix && !value.localPriceSource) {
      ctx.addIssue({
        code: 'custom',
        path: ['localPriceSource'],
        message: 'Un prix local doit dire d’où il vient (marché, boutique, plateforme).',
      });
    }
    if (
      value.localPriceMinXaf !== null &&
      value.localPriceMaxXaf !== null &&
      value.localPriceMinXaf > value.localPriceMaxXaf
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['localPriceMaxXaf'],
        message: 'Le haut de la fourchette doit être supérieur ou égal au bas.',
      });
    }
    const aUneAppreciation =
      value.demand !== null ||
      value.competition !== null ||
      value.risk !== null ||
      value.transportEase !== null ||
      value.capitalRequiredXaf !== null;
    if (aUneAppreciation && !value.assessedAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['assessedAt'],
        message: 'Une appréciation de marché doit porter sa date.',
      });
    }
  });
export type UpdateProductMarketRequest = z.infer<typeof UpdateProductMarketRequestSchema>;

// ═════════════ Gestion des fournisseurs et des niveaux (ADM-04, §16) ═════════════

export const AdminSupplierSearchQuerySchema = z.object({
  recherche: z.string().trim().min(1).max(100).optional(),
  type: SupplierTypeSchema.optional(),
  city: z.string().trim().min(1).max(80).optional(),
  /** Filtre sur le niveau atteint ; `aucun` isole les fiches encore sans preuve. */
  level: z.union([SupplierVerificationLevelSchema, z.literal('aucun')]).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminSupplierSearchQuery = z.infer<typeof AdminSupplierSearchQuerySchema>;

/** Une preuve enregistrée : c'est elle, et elle seule, qui autorise un badge (§16). */
export const AdminSupplierVerificationSchema = z.object({
  id: z.string(),
  level: SupplierVerificationLevelSchema,
  levelLabel: z.string(),
  levelMeaning: z.string(),
  evidenceUrl: z.string().nullable(),
  notes: z.string().nullable(),
  verifiedAt: z.iso.datetime(),
  verifiedByName: z.string().nullable(),
});
export type AdminSupplierVerification = z.infer<typeof AdminSupplierVerificationSchema>;

export const AdminSupplierLevelChangeSchema = z.object({
  id: z.string(),
  fromLevel: SupplierVerificationLevelSchema.nullable(),
  fromLevelLabel: z.string().nullable(),
  toLevel: SupplierVerificationLevelSchema,
  toLevelLabel: z.string(),
  reason: z.string(),
  decidedByName: z.string().nullable(),
  decidedAt: z.iso.datetime(),
  /** Vrai quand le niveau a baissé : une rétrogradation se lit au premier coup d'œil. */
  demotion: z.boolean(),
});
export type AdminSupplierLevelChange = z.infer<typeof AdminSupplierLevelChangeSchema>;

export const AdminSupplierResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: SupplierTypeSchema,
  typeLabel: z.string(),
  city: z.string(),
  moq: z.number().int().nullable(),
  oem: z.boolean(),
  sampleAvailable: z.boolean(),
  leadTimeDays: z.number().int().nullable(),
  publicSummary: z.string().nullable(),
  /** Visuel principal. `null` quand aucune image n'a été déposée. */
  logoUrl: z.string().nullable(),
  /** Niveau atteint, `null` tant qu'aucune preuve n'a été enregistrée. */
  currentLevel: SupplierVerificationLevelSchema.nullable(),
  currentLevelLabel: z.string().nullable(),
  currentLevelSince: z.iso.datetime().nullable(),
  verificationCount: z.number().int(),
  /** Vrai quand la fiche ne porte aucune preuve : aucun badge ne doit s'afficher côté public. */
  unverified: z.boolean(),
  updatedAt: z.iso.datetime(),
});
export type AdminSupplierResponse = z.infer<typeof AdminSupplierResponseSchema>;

export const AdminSupplierListResponseSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  items: z.array(AdminSupplierResponseSchema),
  /** Répartition réelle par niveau, `null` pour les fiches sans preuve. */
  byLevel: z.array(
    z.object({ level: SupplierVerificationLevelSchema.nullable(), count: z.number().int() }),
  ),
  /** Villes présentes en base, pour alimenter le filtre sans en inventer. */
  cities: z.array(z.string()),
});
export type AdminSupplierListResponse = z.infer<typeof AdminSupplierListResponseSchema>;

export const AdminSupplierDetailResponseSchema = z.object({
  supplier: AdminSupplierResponseSchema,
  verifications: z.array(AdminSupplierVerificationSchema),
  changes: z.array(AdminSupplierLevelChangeSchema),
  /** Photos de la fiche, avec leur date et leur auteur : c'est ce qui en fait des preuves. */
  photos: z.array(
    z.object({
      id: z.string(),
      kind: SupplierPhotoKindSchema,
      kindLabel: z.string(),
      url: z.string(),
      caption: z.string().nullable(),
      takenAt: z.iso.datetime(),
      takenBy: z.string().nullable(),
    }),
  ),
  /** Boutiques en ligne. Publiques : elles se trouvent déjà en une recherche. */
  shopLinks: z.array(
    z.object({
      id: z.string(),
      platform: SupplierShopPlatformSchema,
      platformLabel: z.string(),
      url: z.string(),
      label: z.string().nullable(),
      checkedAt: z.iso.datetime().nullable(),
      position: z.number().int(),
    }),
  ),
});
export type AdminSupplierDetailResponse = z.infer<typeof AdminSupplierDetailResponseSchema>;

export const UpdateSupplierRequestSchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  type: SupplierTypeSchema.optional(),
  city: z.string().trim().min(2).max(80).optional(),
  moq: z.number().int().positive().nullable().optional(),
  oem: z.boolean().optional(),
  sampleAvailable: z.boolean().optional(),
  leadTimeDays: z.number().int().positive().nullable().optional(),
  publicSummary: z.string().trim().max(1_000).nullable().optional(),
  /** Visuel principal. Chaîne vide acceptée pour retirer l'image. */
  logoUrl: z.union([z.literal(''), z.url()]).nullable().optional(),
});
export type UpdateSupplierRequest = z.infer<typeof UpdateSupplierRequestSchema>;

/**
 * Création d'un fournisseur depuis le back-office (ADM-04).
 *
 * Il n'existait aucune route de création : on pouvait modifier un fournisseur, pas en
 * ajouter un. Un référentiel qu'on ne peut pas alimenter n'est pas un référentiel.
 *
 * Un fournisseur naît **sans niveau de vérification**. Le niveau s'obtient ensuite par
 * `POST /suppliers/:id/verifications`, qui exige une preuve consultable (§16) : on ne peut
 * donc pas créer un fournisseur déjà badgé, ce qui viderait le badge de son sens.
 */
export const CreateSupplierRequestSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez le nom du fournisseur.').max(140),
  type: SupplierTypeSchema,
  city: z.string().trim().min(2, 'Indiquez la ville.').max(80),
  moq: z.number().int().positive().nullable().default(null),
  oem: z.boolean().default(false),
  sampleAvailable: z.boolean().default(false),
  leadTimeDays: z.number().int().positive().nullable().default(null),
  publicSummary: z.string().trim().max(1_000).nullable().default(null),
  logoUrl: z.union([z.literal(''), z.url()]).nullable().default(null),
});
export type CreateSupplierRequest = z.infer<typeof CreateSupplierRequestSchema>;

/** Boutique en ligne : ajout ou modification. L'URL est vérifiée, pas seulement sa forme. */
export const SupplierShopLinkInputSchema = z.object({
  platform: SupplierShopPlatformSchema,
  url: z.url({ message: 'Indiquez l’adresse complète de la boutique, https:// compris.' }),
  label: z.string().trim().max(120).nullable().default(null),
  /** Date du contrôle du lien. `null` tant qu'il n'a pas été ouvert pour vérifier. */
  checkedAt: z.iso.datetime().nullable().default(null),
  position: z.number().int().min(0).max(99).default(0),
});
export type SupplierShopLinkInput = z.infer<typeof SupplierShopLinkInputSchema>;

/**
 * Photo de fournisseur : usine, ligne de production, entrepôt, échantillon, emballage, équipe.
 *
 * `takenAt` et `takenBy` sont exigés : une photo sans date ni auteur n'est pas une preuve,
 * c'est une illustration — et la fiche l'afficherait pourtant à côté d'un badge.
 */
export const SupplierPhotoInputSchema = z.object({
  kind: SupplierPhotoKindSchema,
  url: z.url({ message: 'Indiquez l’adresse de l’image.' }),
  caption: z.string().trim().max(200).nullable().default(null),
  takenAt: z.iso.datetime({ message: 'Indiquez la date de prise de vue.' }),
  takenBy: z.string().trim().min(2, 'Indiquez qui a pris la photo.').max(120),
});
export type SupplierPhotoInput = z.infer<typeof SupplierPhotoInputSchema>;

/**
 * Changement de niveau de vérification (§16).
 *
 * `evidenceUrl` est exigée, et pas par formalisme : un badge affiché au public engage la
 * plateforme. Sans document consultable, le serveur refuse — y compris pour une
 * rétrogradation, qui doit elle aussi reposer sur un constat et non sur une impression.
 */
export const ChangeSupplierLevelRequestSchema = z.object({
  level: SupplierVerificationLevelSchema,
  evidenceUrl: z.url({ message: 'La preuve doit être un lien consultable vers le document.' }),
  notes: z.string().trim().max(1_000).nullable().default(null),
  /** Date du contrôle, qui n'est pas celle de la saisie. */
  verifiedAt: z.iso.datetime(),
  reason: z.string().trim().min(10).max(300),
});
export type ChangeSupplierLevelRequest = z.infer<typeof ChangeSupplierLevelRequestSchema>;

export const ChangeSupplierLevelResponseSchema = z.object({
  supplier: AdminSupplierResponseSchema,
  verification: AdminSupplierVerificationSchema,
  change: AdminSupplierLevelChangeSchema,
});
export type ChangeSupplierLevelResponse = z.infer<typeof ChangeSupplierLevelResponseSchema>;

// ═══════════ Gestion des formations et des ressources (ADM-05, §26) ═══════════

/**
 * Le back-office pilote ce que l'Academy sert. Même principe que pour les produits :
 * une formation se construit hors ligne, puis se publie quand elle tient debout. Le
 * serveur dit ce qui manque ; l'écran ne redéfinit pas la règle de son côté.
 */

export const AdminCourseSearchQuerySchema = z.object({
  recherche: z.string().trim().min(1).max(100).optional(),
  level: CourseLevelSchema.optional(),
  theme: CourseThemeSchema.optional(),
  /** `oui` ne garde que les formations publiées, `non` que les brouillons. */
  publiee: z.enum(['oui', 'non']).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminCourseSearchQuery = z.infer<typeof AdminCourseSearchQuerySchema>;

export const AdminInstructorSchema = z.object({
  id: z.string(),
  name: z.string(),
  headline: z.string(),
  bio: z.string().nullable(),
  photoUrl: z.string().nullable(),
  courseCount: z.number().int(),
});
export type AdminInstructor = z.infer<typeof AdminInstructorSchema>;

export const CreateInstructorRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  /** Ce que la personne fait réellement, en une ligne. Aucun titre inventé (§54). */
  headline: z.string().trim().min(5).max(200),
  bio: z.string().trim().max(2_000).nullable().default(null),
  photoUrl: z.url().nullable().default(null),
});
export type CreateInstructorRequest = z.infer<typeof CreateInstructorRequestSchema>;

export const AdminLessonSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  position: z.number().int(),
  durationMinutes: z.number().int(),
  /** Vrai quand une vidéo a été déposée : l'URL de lecture, elle, se signe à la demande. */
  hasVideo: z.boolean(),
  preview: z.boolean(),
  published: z.boolean(),
  documentCount: z.number().int(),
  /** Documents attachés, pour pouvoir les retirer sans ouvrir une autre page. */
  documents: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      fileFormat: z.string(),
      url: z.string(),
    }),
  ),
});
export type AdminLesson = z.infer<typeof AdminLessonSchema>;

/**
 * Document attaché à une leçon : PDF, modèle, checklist.
 *
 * Le format est demandé séparément de l'URL plutôt que deviné à partir de son extension :
 * beaucoup d'hébergeurs servent un fichier sous une adresse qui n'en porte aucune, et
 * annoncer « pdf » parce que l'adresse finit par `/download` serait une supposition.
 */
export const LessonDocumentInputSchema = z.object({
  title: z.string().trim().min(2, 'Donnez un titre au document.').max(160),
  url: z.url({ message: 'Indiquez l’adresse du fichier.' }),
  fileFormat: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((valeur) => valeur.toLowerCase().replace(/^\./, '')),
  sizeBytes: z.number().int().positive().nullable().default(null),
});
export type LessonDocumentInput = z.infer<typeof LessonDocumentInputSchema>;

export const AdminChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  position: z.number().int(),
  lessons: z.array(AdminLessonSchema),
});
export type AdminChapter = z.infer<typeof AdminChapterSchema>;

export const AdminCourseResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  description: z.string(),
  level: CourseLevelSchema,
  levelLabel: z.string(),
  theme: CourseThemeSchema,
  themeLabel: z.string(),
  access: CourseAccessSchema,
  accessLabel: z.string(),
  priceXaf: xaf,
  outcomes: z.array(z.string()),
  prerequisites: z.array(z.string()),
  instructorId: z.string(),
  instructorName: z.string(),
  chapterCount: z.number().int(),
  lessonCount: z.number().int(),
  /** Seules les leçons publiées comptent dans la durée annoncée au public. */
  publishedLessonCount: z.number().int(),
  durationMinutes: z.number().int(),
  enrollmentCount: z.number().int(),
  reviewCount: z.number().int(),
  published: z.boolean(),
  publishedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  /** Ce qui manque pour publier. Vide quand la formation est publiable. */
  missingForPublication: z.array(z.string()),
});
export type AdminCourseResponse = z.infer<typeof AdminCourseResponseSchema>;

export const AdminCourseListResponseSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  items: z.array(AdminCourseResponseSchema),
  publishedCount: z.number().int(),
  draftCount: z.number().int(),
});
export type AdminCourseListResponse = z.infer<typeof AdminCourseListResponseSchema>;

export const AdminResourceSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  type: ResourceTypeSchema,
  typeLabel: z.string(),
  theme: CourseThemeSchema,
  themeLabel: z.string(),
  fileFormat: z.string(),
  sizeBytes: z.number().int().nullable(),
  pageCount: z.number().int().nullable(),
  /** Faux tant qu'aucun fichier n'a été déposé : la ressource n'est alors pas publiable. */
  hasFile: z.boolean(),
  free: z.boolean(),
  courseId: z.string().nullable(),
  courseTitle: z.string().nullable(),
  published: z.boolean(),
  publishedAt: z.iso.datetime().nullable(),
});
export type AdminResource = z.infer<typeof AdminResourceSchema>;

export const AdminCourseDetailResponseSchema = z.object({
  course: AdminCourseResponseSchema,
  chapters: z.array(AdminChapterSchema),
  resources: z.array(AdminResourceSchema),
});
export type AdminCourseDetailResponse = z.infer<typeof AdminCourseDetailResponseSchema>;

/**
 * Création d'une formation. `access` et `priceXaf` doivent s'accorder : une formation
 * annoncée gratuite à 15 000 FCFA, ou payante à 0, est une promesse contradictoire pour
 * qui la lit. Le contrat refuse la combinaison plutôt que de la corriger en silence.
 */
export const CreateCourseRequestSchema = z
  .object({
    title: z.string().trim().min(5).max(160),
    summary: z.string().trim().min(10).max(300),
    description: z.string().trim().min(20).max(5_000),
    level: CourseLevelSchema,
    theme: CourseThemeSchema,
    access: CourseAccessSchema.default('FREE'),
    priceXaf: xaf.nonnegative().default(0),
    outcomes: z.array(z.string().trim().min(3).max(200)).max(10).default([]),
    prerequisites: z.array(z.string().trim().min(3).max(200)).max(10).default([]),
    instructorId: z.string().min(1),
    coverUrl: z.url().nullable().default(null),
    trailerUrl: z.url().nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.access === 'PAID' && value.priceXaf <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceXaf'],
        message: 'Une formation payante doit porter son prix.',
      });
    }
    if (value.access !== 'PAID' && value.priceXaf !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceXaf'],
        message: 'Une formation gratuite ou incluse dans l’abonnement ne porte pas de prix.',
      });
    }
  });
export type CreateCourseRequest = z.infer<typeof CreateCourseRequestSchema>;

/** Modification : même accord `access`/`priceXaf`, vérifié sur l'état résultant par le serveur. */
export const UpdateCourseRequestSchema = z.object({
  title: z.string().trim().min(5).max(160).optional(),
  summary: z.string().trim().min(10).max(300).optional(),
  description: z.string().trim().min(20).max(5_000).optional(),
  level: CourseLevelSchema.optional(),
  theme: CourseThemeSchema.optional(),
  access: CourseAccessSchema.optional(),
  priceXaf: xaf.nonnegative().optional(),
  outcomes: z.array(z.string().trim().min(3).max(200)).max(10).optional(),
  prerequisites: z.array(z.string().trim().min(3).max(200)).max(10).optional(),
  instructorId: z.string().min(1).optional(),
  coverUrl: z.url().nullable().optional(),
  trailerUrl: z.url().nullable().optional(),
});
export type UpdateCourseRequest = z.infer<typeof UpdateCourseRequestSchema>;

/** Publication ou retrait, d'une formation comme d'une ressource. Le motif part à l'audit. */
export const UpdatePublicationRequestSchema = z.object({
  published: z.boolean(),
  reason: z.string().trim().min(5).max(300),
});
export type UpdatePublicationRequest = z.infer<typeof UpdatePublicationRequestSchema>;

export const CreateChapterRequestSchema = z.object({
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().max(500).nullable().default(null),
});
export type CreateChapterRequest = z.infer<typeof CreateChapterRequestSchema>;

export const UpdateChapterRequestSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  summary: z.string().trim().max(500).nullable().optional(),
  /** Nouvelle place dans le sommaire, à partir de 1. */
  position: z.number().int().positive().optional(),
});
export type UpdateChapterRequest = z.infer<typeof UpdateChapterRequestSchema>;

export const CreateLessonRequestSchema = z.object({
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().max(500).nullable().default(null),
  durationMinutes: z.number().int().nonnegative().max(600).default(0),
  /** Leçon offerte en extrait : lisible sans compte ni achat. */
  preview: z.boolean().default(false),
});
export type CreateLessonRequest = z.infer<typeof CreateLessonRequestSchema>;

export const UpdateLessonRequestSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  summary: z.string().trim().max(500).nullable().optional(),
  durationMinutes: z.number().int().nonnegative().max(600).optional(),
  preview: z.boolean().optional(),
  position: z.number().int().positive().optional(),
  /** Identifiant Cloudinary de la vidéo, et son extension : les deux vont ensemble. */
  videoPublicId: z.string().trim().min(1).max(300).nullable().optional(),
  videoFormat: z.string().trim().min(2).max(10).nullable().optional(),
  published: z.boolean().optional(),
});
export type UpdateLessonRequest = z.infer<typeof UpdateLessonRequestSchema>;

export const AdminResourceSearchQuerySchema = z.object({
  recherche: z.string().trim().min(1).max(100).optional(),
  type: ResourceTypeSchema.optional(),
  theme: CourseThemeSchema.optional(),
  publiee: z.enum(['oui', 'non']).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminResourceSearchQuery = z.infer<typeof AdminResourceSearchQuerySchema>;

export const AdminResourceListResponseSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  items: z.array(AdminResourceSchema),
  publishedCount: z.number().int(),
  draftCount: z.number().int(),
});
export type AdminResourceListResponse = z.infer<typeof AdminResourceListResponseSchema>;

export const UpdateResourceRequestSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().min(10).max(1_000).optional(),
  type: ResourceTypeSchema.optional(),
  theme: CourseThemeSchema.optional(),
  free: z.boolean().optional(),
  courseId: z.string().min(1).nullable().optional(),
  pageCount: z.number().int().positive().nullable().optional(),
});
export type UpdateResourceRequest = z.infer<typeof UpdateResourceRequestSchema>;

export const AdminInstructorListResponseSchema = z.object({
  items: z.array(AdminInstructorSchema),
});
export type AdminInstructorListResponse = z.infer<typeof AdminInstructorListResponseSchema>;

// ═══════════════════ Paiements vus du back-office (ADM-06) ═══════════════════

/**
 * Les paiements ne se modifient pas depuis le back-office : leur état vient de
 * l'agrégateur, et lui seul. Cet écran est en lecture, et c'est voulu — pouvoir marquer
 * un paiement « reçu » à la main serait le moyen le plus simple d'encaisser une commande
 * qui n'a jamais été payée.
 */
export const AdminPaymentSearchQuerySchema = z.object({
  statut: PaymentStatusSchema.optional(),
  methode: PaymentMethodSchema.optional(),
  /** Référence de paiement, référence de commande, nom ou email du client. */
  recherche: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  taille: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminPaymentSearchQuery = z.output<typeof AdminPaymentSearchQuerySchema>;

export const AdminPaymentResponseSchema = z.object({
  reference: z.string(),
  status: PaymentStatusSchema,
  statusLabel: z.string(),
  method: PaymentMethodSchema,
  methodLabel: z.string(),
  amountXaf: xaf,
  refundedXaf: xaf,
  provider: z.string(),
  /** Identifiant de la transaction chez l'agrégateur, pour la retrouver de leur côté. */
  providerRef: z.string().nullable(),
  payerPhone: z.string().nullable(),
  failureReason: z.string().nullable(),
  customerName: z.string(),
  customerEmail: z.string(),
  /** Ce que ce paiement règle : une commande de marchandise, ou une prestation. */
  target: z.enum(['ORDER', 'SERVICE_ORDER', 'NONE']),
  targetReference: z.string().nullable(),
  /** Dernière vérification auprès de l'agrégateur, `null` si elle n'a jamais eu lieu. */
  lastCheckedAt: z.iso.datetime().nullable(),
  paidAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type AdminPaymentResponse = z.infer<typeof AdminPaymentResponseSchema>;

export const AdminPaymentListResponseSchema = z.object({
  page: z.number().int(),
  taille: z.number().int(),
  total: z.number().int(),
  items: z.array(AdminPaymentResponseSchema),
  /** Répartition par état sur l'ensemble du fichier, pas sur la page affichée. */
  byStatus: z.array(z.object({ status: PaymentStatusSchema, count: z.number().int() })),
  /**
   * Montant réellement encaissé, c'est-à-dire la somme des paiements confirmés moins les
   * remboursements. Les paiements en attente n'y figurent pas : tant qu'ils ne sont pas
   * confirmés, cet argent n'existe pas (§54).
   */
  settledXaf: xaf,
  /** Nombre de paiements encore ouverts, qui attendent la confirmation de l'agrégateur. */
  pendingCount: z.number().int(),
});
export type AdminPaymentListResponse = z.infer<typeof AdminPaymentListResponseSchema>;

// ═══════════════ État des intégrations (exploitation) ═══════════════

/**
 * Ce que le serveur sait de sa propre configuration.
 *
 * Aucune valeur secrète n'est renvoyée : seulement « configuré » ou non, et ce que
 * l'absence entraîne concrètement. L'intérêt est qu'une clé manquante se voie avant
 * qu'un client ne la découvre à sa place — un secret de webhook absent, par exemple,
 * fait rejeter toutes les confirmations de paiement.
 */
export const INTEGRATION_HEALTHS = ['OK', 'DEGRADED', 'MISSING'] as const;
export const IntegrationHealthSchema = z.enum(INTEGRATION_HEALTHS);
export type IntegrationHealth = z.infer<typeof IntegrationHealthSchema>;

export const IntegrationStatusSchema = z.object({
  key: z.string(),
  label: z.string(),
  health: IntegrationHealthSchema,
  /** Ce qui est en place, en une phrase. */
  detail: z.string(),
  /** Ce que l'absence entraîne, `null` quand tout est en place. */
  consequence: z.string().nullable(),
});
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;

export const AdminIntegrationsResponseSchema = z.object({
  environment: z.string(),
  items: z.array(IntegrationStatusSchema),
});
export type AdminIntegrationsResponse = z.infer<typeof AdminIntegrationsResponseSchema>;
