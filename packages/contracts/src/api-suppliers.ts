import { z } from 'zod';
import { InterestCategorySchema } from './onboarding.js';
import { SupplierTypeSchema, SupplierVerificationLevelSchema } from './supplier.js';

/**
 * Fournisseurs et sourcing (lot SUP).
 *
 * Schémas de requête et de réponse de ce lot. Les décrire ici permet au serveur de typer
 * ses contrôleurs et au client du site d'être généré à partir du même contrat.
 * Ne rien écrire ici qui appartienne à un autre lot.
 *
 * Les valeurs d'énumération ci-dessous sont identiques à celles de
 * apps/api/prisma/schema/suppliers.prisma.
 */

// ───────────────────────── Énumérations du lot ─────────────────────────

export const SUPPLIER_FACTORY_SCALES = ['WORKSHOP', 'SMALL', 'MEDIUM', 'LARGE'] as const;
export const SupplierFactoryScaleSchema = z.enum(SUPPLIER_FACTORY_SCALES);
export type SupplierFactoryScale = z.infer<typeof SupplierFactoryScaleSchema>;

export const SUPPLIER_FACTORY_SCALE_LABELS: Record<SupplierFactoryScale, string> = {
  WORKSHOP: 'Atelier (moins de 20 personnes)',
  SMALL: 'Petite usine (20 à 100 personnes)',
  MEDIUM: 'Usine moyenne (100 à 500 personnes)',
  LARGE: 'Grande usine (plus de 500 personnes)',
};

export const SUPPLIER_DOCUMENT_KINDS = [
  'BUSINESS_LICENSE',
  'EXPORT_LICENSE',
  'CERTIFICATION',
  'FACTORY_AUDIT',
  'QUALITY_REPORT',
  'OTHER',
] as const;
export const SupplierDocumentKindSchema = z.enum(SUPPLIER_DOCUMENT_KINDS);
export type SupplierDocumentKind = z.infer<typeof SupplierDocumentKindSchema>;

export const SUPPLIER_DOCUMENT_KIND_LABELS: Record<SupplierDocumentKind, string> = {
  BUSINESS_LICENSE: 'Licence d’entreprise',
  EXPORT_LICENSE: 'Licence d’export',
  CERTIFICATION: 'Certification produit',
  FACTORY_AUDIT: 'Audit d’usine',
  QUALITY_REPORT: 'Rapport de qualité',
  OTHER: 'Autre document',
};

export const SUPPLIER_INCIDENT_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;
export const SupplierIncidentSeveritySchema = z.enum(SUPPLIER_INCIDENT_SEVERITIES);
export type SupplierIncidentSeverity = z.infer<typeof SupplierIncidentSeveritySchema>;

export const SUPPLIER_INCIDENT_SEVERITY_LABELS: Record<SupplierIncidentSeverity, string> = {
  MINOR: 'Incident mineur',
  MAJOR: 'Incident important',
  CRITICAL: 'Incident grave',
};

export const SUPPLIER_INCIDENT_STATUSES = ['OPEN', 'RESOLVED'] as const;
export const SupplierIncidentStatusSchema = z.enum(SUPPLIER_INCIDENT_STATUSES);
export type SupplierIncidentStatus = z.infer<typeof SupplierIncidentStatusSchema>;

export const SUPPLIER_INCIDENT_STATUS_LABELS: Record<SupplierIncidentStatus, string> = {
  OPEN: 'En cours de traitement',
  RESOLVED: 'Résolu',
};

export const SUPPLIER_PHOTO_KINDS = [
  'FACTORY',
  'PRODUCTION_LINE',
  'WAREHOUSE',
  'SAMPLE',
  'PACKAGING',
  'TEAM',
] as const;
export const SupplierPhotoKindSchema = z.enum(SUPPLIER_PHOTO_KINDS);
export type SupplierPhotoKind = z.infer<typeof SupplierPhotoKindSchema>;

export const SUPPLIER_PHOTO_KIND_LABELS: Record<SupplierPhotoKind, string> = {
  FACTORY: 'Bâtiment',
  PRODUCTION_LINE: 'Ligne de production',
  WAREHOUSE: 'Entrepôt',
  SAMPLE: 'Échantillon',
  PACKAGING: 'Emballage',
  TEAM: 'Équipe',
};

export const SUPPLIER_PAYMENT_TERMS = [
  'FULL_PREPAYMENT',
  'DEPOSIT_30_70',
  'DEPOSIT_50_50',
  'ON_DELIVERY',
  'ESCROW',
] as const;
export const SupplierPaymentTermSchema = z.enum(SUPPLIER_PAYMENT_TERMS);
export type SupplierPaymentTerm = z.infer<typeof SupplierPaymentTermSchema>;

export const SUPPLIER_PAYMENT_TERM_LABELS: Record<SupplierPaymentTerm, string> = {
  FULL_PREPAYMENT: 'Paiement intégral à la commande',
  DEPOSIT_30_70: 'Acompte 30 %, solde avant expédition',
  DEPOSIT_50_50: 'Acompte 50 %, solde avant expédition',
  ON_DELIVERY: 'Paiement à la livraison',
  ESCROW: 'Paiement séquestré (Alibaba Trade Assurance ou équivalent)',
};

export const SUPPLIER_TEST_ORDER_OUTCOMES = ['CONFORMING', 'RESERVATION', 'NON_CONFORMING'] as const;
export const SupplierTestOrderOutcomeSchema = z.enum(SUPPLIER_TEST_ORDER_OUTCOMES);
export type SupplierTestOrderOutcome = z.infer<typeof SupplierTestOrderOutcomeSchema>;

export const SUPPLIER_TEST_ORDER_OUTCOME_LABELS: Record<SupplierTestOrderOutcome, string> = {
  CONFORMING: 'Conforme à la commande',
  RESERVATION: 'Conforme avec réserve',
  NON_CONFORMING: 'Non conforme',
};

export const SUPPLIER_REQUEST_KINDS = ['QUOTE', 'SOURCING'] as const;
export const SupplierRequestKindSchema = z.enum(SUPPLIER_REQUEST_KINDS);
export type SupplierRequestKind = z.infer<typeof SupplierRequestKindSchema>;

export const SUPPLIER_REQUEST_KIND_LABELS: Record<SupplierRequestKind, string> = {
  QUOTE: 'Demande de devis',
  SOURCING: 'Demande de sourcing',
};

export const SUPPLIER_REQUEST_STATUSES = ['SUBMITTED', 'IN_PROGRESS', 'ANSWERED', 'CLOSED'] as const;
export const SupplierRequestStatusSchema = z.enum(SUPPLIER_REQUEST_STATUSES);
export type SupplierRequestStatus = z.infer<typeof SupplierRequestStatusSchema>;

/**
 * Ordre de confiance croissant des niveaux (§16). Sert à choisir le niveau à afficher
 * quand plusieurs preuves existent : c'est toujours le plus haut niveau *prouvé*.
 */
export const SUPPLIER_VERIFICATION_RANK = {
  IDENTITY_VERIFIED: 1,
  SUPPLIER_TESTED: 2,
  QUALITY_TESTED: 3,
  PARTNER: 4,
} as const;

// ───────────────────────── Vérification (SUP-02) ─────────────────────────

/**
 * Un badge n'existe jamais seul : il porte toujours sa preuve et sa date (§16, §54).
 * Une vérification sans `evidenceUrl` n'est pas une preuve et ne produit aucun badge.
 */
export const SupplierVerificationProofSchema = z.object({
  id: z.string(),
  level: SupplierVerificationLevelSchema,
  levelLabel: z.string(),
  /** Ce qui a été contrôlé, en toutes lettres. Jamais un « vérifié » vague. */
  meaning: z.string(),
  evidenceUrl: z.string(),
  notes: z.string().nullable(),
  verifiedAt: z.iso.datetime(),
});
export type SupplierVerificationProof = z.infer<typeof SupplierVerificationProofSchema>;

/** Badge courant : `null` tant qu'aucune preuve n'a été enregistrée. */
export const SupplierVerificationSummarySchema = z
  .object({
    level: SupplierVerificationLevelSchema,
    levelLabel: z.string(),
    meaning: z.string(),
    /** Date de la preuve qui justifie le niveau affiché. */
    verifiedAt: z.iso.datetime(),
    /** Date du dernier contrôle, tous niveaux confondus. */
    lastVerifiedAt: z.iso.datetime(),
    evidenceUrl: z.string(),
  })
  .nullable();

export const SupplierLevelChangeSchema = z.object({
  id: z.string(),
  fromLevel: SupplierVerificationLevelSchema.nullable(),
  toLevel: SupplierVerificationLevelSchema,
  reason: z.string(),
  decidedAt: z.iso.datetime(),
});

/** Enregistrement d'une preuve et promotion associée. Réservé à l'équipe interne. */
export const RecordSupplierVerificationBodySchema = z.object({
  level: SupplierVerificationLevelSchema,
  /** Sans preuve, pas de badge : le champ est obligatoire et non vide. */
  evidenceUrl: z.string().min(5).max(500),
  verifiedAt: z.iso.datetime(),
  notes: z.string().max(1000).optional(),
  reason: z.string().min(3).max(300),
});
export type RecordSupplierVerificationBody = z.infer<typeof RecordSupplierVerificationBodySchema>;

export const RecordSupplierVerificationResponseSchema = z.object({
  verification: SupplierVerificationSummarySchema,
  proofs: z.array(SupplierVerificationProofSchema),
  history: z.array(SupplierLevelChangeSchema),
});
export type RecordSupplierVerificationResponse = z.infer<typeof RecordSupplierVerificationResponseSchema>;

// ───────────────────────── Recherche et filtres (SUP-03) ─────────────────────────

/** `?oem=true` arrive en texte : on n'accepte que « true » ou « false », jamais n'importe quoi. */
const BooleanFilterSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const IntFilterSchema = z.coerce.number().int().positive();

export const SupplierListQuerySchema = z.object({
  /** Recherche libre sur le nom du fournisseur et sur les produits proposés. */
  q: z.string().trim().min(1).max(80).optional(),
  category: InterestCategorySchema.optional(),
  city: z.string().trim().min(2).max(80).optional(),
  type: SupplierTypeSchema.optional(),
  /** Ne garder que les fournisseurs dont le MOQ est inférieur ou égal à cette quantité. */
  moqMax: IntFilterSchema.optional(),
  /** Personnalisation possible (marque, logo, packaging). */
  customization: BooleanFilterSchema,
  /** Échantillon disponible avant commande. */
  sample: BooleanFilterSchema,
  /** Niveau minimal de vérification prouvé. */
  minLevel: SupplierVerificationLevelSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
export type SupplierListQuery = z.infer<typeof SupplierListQuerySchema>;

/** Carte de liste : uniquement ce qui tient sur un écran de téléphone (§44). */
export const SupplierCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: SupplierTypeSchema,
  typeLabel: z.string(),
  city: z.string(),
  moq: z.number().int().nullable(),
  customization: z.boolean(),
  sampleAvailable: z.boolean(),
  leadTimeDays: z.number().int().nullable(),
  publicSummary: z.string().nullable(),
  /** Visuel principal. `null` quand aucune image n'a été déposée : la carte affiche alors
   *  un emplacement explicite, jamais une image générique prise ailleurs. */
  logoUrl: z.string().nullable(),
  categories: z.array(InterestCategorySchema),
  /** Trois produits au plus, pour donner une idée sans surcharger la carte. */
  topOfferings: z.array(z.string()),
  verification: SupplierVerificationSummarySchema,
  /** Incidents encore ouverts : un risque ne se masque jamais (§17). */
  openIncidents: z.number().int(),
});
export type SupplierCard = z.infer<typeof SupplierCardSchema>;

export const SupplierListResponseSchema = z.object({
  items: z.array(SupplierCardSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  /** Villes réellement présentes en base : aucun filtre ne propose une valeur sans résultat. */
  availableCities: z.array(z.string()),
});
export type SupplierListResponse = z.infer<typeof SupplierListResponseSchema>;

// ───────────────────────── Fiche détaillée (SUP-05) ─────────────────────────

export const SupplierProfileSchema = z
  .object({
    foundedYear: z.number().int().nullable(),
    employeeCount: z.number().int().nullable(),
    factoryScale: SupplierFactoryScaleSchema.nullable(),
    factoryScaleLabel: z.string().nullable(),
    productionLines: z.number().int().nullable(),
    monthlyCapacity: z.number().int().nullable(),
    ownsFactory: z.boolean(),
    exportExperienceYears: z.number().int().nullable(),
    province: z.string().nullable(),
    certifications: z.array(z.string()),
    mainMarkets: z.array(z.string()),
    languages: z.array(z.string()),
    responseTimeHours: z.number().int().nullable(),
    presentation: z.string().nullable(),
    /** Date du dernier contrôle de ces informations. Affichée à côté d'elles (§2). */
    checkedAt: z.iso.datetime().nullable(),
  })
  .nullable();

export const SupplierOfferingSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: InterestCategorySchema,
  categoryLabel: z.string(),
  description: z.string().nullable(),
  /** Prix unitaire indicatif en fen (1 CNY = 100 fen). Toujours accompagné de sa date. */
  unitPriceCnyMinor: z.number().int().nullable(),
  priceObservedAt: z.iso.datetime().nullable(),
  moq: z.number().int().nullable(),
  customizable: z.boolean(),
  sampleAvailable: z.boolean(),
  leadTimeDays: z.number().int().nullable(),
});

export const SupplierTermsSchema = z
  .object({
    minOrderValueCnyMinor: z.number().int().nullable(),
    paymentTerms: z.array(SupplierPaymentTermSchema),
    paymentTermLabels: z.array(z.string()),
    depositPercent: z.number().int().nullable(),
    sampleAvailable: z.boolean(),
    sampleCostCnyMinor: z.number().int().nullable(),
    sampleLeadTimeDays: z.number().int().nullable(),
    customizationOptions: z.array(z.string()),
    packagingOptions: z.array(z.string()),
    incoterms: z.array(z.string()),
    productionLeadTimeDays: z.number().int().nullable(),
    negotiable: z.boolean(),
    checkedAt: z.iso.datetime().nullable(),
  })
  .nullable();

export const SupplierDocumentSchema = z.object({
  id: z.string(),
  kind: SupplierDocumentKindSchema,
  kindLabel: z.string(),
  label: z.string(),
  fileUrl: z.string(),
  issuedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  verifiedAt: z.iso.datetime(),
});

export const SupplierIncidentSchema = z.object({
  id: z.string(),
  occurredAt: z.iso.datetime(),
  severity: SupplierIncidentSeveritySchema,
  severityLabel: z.string(),
  status: SupplierIncidentStatusSchema,
  statusLabel: z.string(),
  summary: z.string(),
  resolution: z.string().nullable(),
  resolvedAt: z.iso.datetime().nullable(),
});

export const SupplierTestOrderSchema = z.object({
  id: z.string(),
  orderedAt: z.iso.datetime(),
  receivedAt: z.iso.datetime().nullable(),
  productLabel: z.string(),
  quantity: z.number().int(),
  amountCnyMinor: z.number().int(),
  outcome: SupplierTestOrderOutcomeSchema,
  outcomeLabel: z.string(),
  inspectionReportUrl: z.string().nullable(),
  notes: z.string().nullable(),
});

export const SupplierPhotoSchema = z.object({
  id: z.string(),
  kind: SupplierPhotoKindSchema,
  kindLabel: z.string(),
  url: z.string(),
  caption: z.string().nullable(),
  takenAt: z.iso.datetime(),
  takenBy: z.string().nullable(),
});

/**
 * Plateformes de boutique en ligne. `C1688` plutôt que `1688` : une valeur d'énumération
 * ne peut pas commencer par un chiffre, ni en Prisma ni en TypeScript. Le libellé, lui,
 * affiche bien « 1688 ».
 */
export const SUPPLIER_SHOP_PLATFORMS = [
  'ALIBABA',
  'C1688',
  'MADE_IN_CHINA',
  'GLOBAL_SOURCES',
  'DHGATE',
  'TAOBAO',
  'WEBSITE',
  'OTHER',
] as const;
export const SupplierShopPlatformSchema = z.enum(SUPPLIER_SHOP_PLATFORMS);
export type SupplierShopPlatform = z.infer<typeof SupplierShopPlatformSchema>;

export const SUPPLIER_SHOP_PLATFORM_LABELS: Record<SupplierShopPlatform, string> = {
  ALIBABA: 'Alibaba',
  C1688: '1688',
  MADE_IN_CHINA: 'Made-in-China',
  GLOBAL_SOURCES: 'Global Sources',
  DHGATE: 'DHgate',
  TAOBAO: 'Taobao',
  WEBSITE: 'Site du fournisseur',
  OTHER: 'Autre plateforme',
};

/**
 * Boutique en ligne d'un fournisseur.
 *
 * Publique, à la différence des coordonnées : une vitrine 1688 ou Alibaba est déjà ouverte
 * à tout le monde, et la masquer ne protégerait rien. Ce qui reste réservé, ce sont les
 * coordonnées directes (§17).
 */
export const SupplierShopLinkSchema = z.object({
  id: z.string(),
  platform: SupplierShopPlatformSchema,
  platformLabel: z.string(),
  url: z.string(),
  /** Nom de la boutique, quand il diffère du nom du fournisseur. */
  label: z.string().nullable(),
  /** Date du dernier contrôle du lien. `null` : jamais vérifié, et c'est dit. */
  checkedAt: z.iso.datetime().nullable(),
});
export type SupplierShopLink = z.infer<typeof SupplierShopLinkSchema>;

/**
 * Aperçu public de la fiche (§17) : tout y est sauf les coordonnées.
 * `contactAccess` dit si le compte courant peut les obtenir, et pourquoi pas le cas échéant.
 */
export const SupplierDetailResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: SupplierTypeSchema,
  typeLabel: z.string(),
  city: z.string(),
  moq: z.number().int().nullable(),
  customization: z.boolean(),
  sampleAvailable: z.boolean(),
  leadTimeDays: z.number().int().nullable(),
  publicSummary: z.string().nullable(),
  /** Visuel principal. `null` quand aucune image n'a été déposée : rien n'est inventé. */
  logoUrl: z.string().nullable(),
  shopLinks: z.array(SupplierShopLinkSchema),
  profile: SupplierProfileSchema,
  offerings: z.array(SupplierOfferingSchema),
  terms: SupplierTermsSchema,
  documents: z.array(SupplierDocumentSchema),
  incidents: z.array(SupplierIncidentSchema),
  testOrders: z.array(SupplierTestOrderSchema),
  photos: z.array(SupplierPhotoSchema),
  verification: SupplierVerificationSummarySchema,
  proofs: z.array(SupplierVerificationProofSchema),
  levelHistory: z.array(SupplierLevelChangeSchema),
  contactAccess: z.object({
    granted: z.boolean(),
    /** Message affiché quand l'accès est refusé. Explique l'offre, sans masquer les risques. */
    reason: z.string(),
  }),
});
export type SupplierDetailResponse = z.infer<typeof SupplierDetailResponseSchema>;

// ───────────────────────── Coordonnées réservées (SUP-04) ─────────────────────────

export const SupplierContactResponseSchema = z.object({
  supplierId: z.string(),
  contactName: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  wechat: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  storeUrl: z.string().nullable(),
  addressLine: z.string().nullable(),
  /** Date de consultation, enregistrée côté serveur. */
  accessedAt: z.iso.datetime(),
});
export type SupplierContactResponse = z.infer<typeof SupplierContactResponseSchema>;

// ───────────────────────── Demandes depuis la fiche (SUP-05) ─────────────────────────

export const CreateSupplierRequestBodySchema = z.object({
  kind: SupplierRequestKindSchema,
  productLabel: z.string().trim().min(3).max(160),
  quantity: z.number().int().positive().max(1_000_000).optional(),
  /** Budget en FCFA (unité mineure = 1 FCFA), jamais en nombre à virgule. */
  budgetXafMinor: z.number().int().positive().optional(),
  city: z.string().trim().min(2).max(80).optional(),
  details: z.string().trim().max(2000).optional(),
});
export type CreateSupplierRequestBody = z.infer<typeof CreateSupplierRequestBodySchema>;

export const SupplierRequestResponseSchema = z.object({
  reference: z.string(),
  kind: SupplierRequestKindSchema,
  kindLabel: z.string(),
  status: SupplierRequestStatusSchema,
  supplierName: z.string(),
  createdAt: z.iso.datetime(),
  /** Ce qui va se passer ensuite, en une phrase (§45). */
  nextStep: z.string(),
});
export type SupplierRequestResponse = z.infer<typeof SupplierRequestResponseSchema>;
