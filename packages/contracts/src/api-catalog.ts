/**
 * Produits et opportunités (lot CAT).
 *
 * Schémas de requête et de réponse de ce lot. Les décrire ici permet au serveur de typer
 * ses contrôleurs et au client du site d'être généré à partir du même contrat.
 * Ne rien écrire ici qui appartienne à un autre lot.
 *
 * Règles respectées (§54) :
 * - tous les montants sont des entiers en unités mineures (1 FCFA = 1) ;
 * - toute donnée de marché porte sa date et sa source, sinon elle vaut `null` ;
 * - tout chiffre calculé est marqué `ESTIMATE` et expose ses hypothèses.
 */
import { z } from 'zod';
import { CurrencySchema } from './money.js';
import { InterestCategorySchema } from './onboarding.js';
import { DataProvenanceSchema } from './provenance.js';

// ───────────────────────── Énumérations du catalogue ─────────────────────────

/** Niveau relevé pour la demande locale et pour la concurrence (§12). */
export const MARKET_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const MarketLevelSchema = z.enum(MARKET_LEVELS);
export type MarketLevel = z.infer<typeof MarketLevelSchema>;

export const DEMAND_LEVEL_LABELS: Record<MarketLevel, string> = {
  LOW: 'Demande faible',
  MEDIUM: 'Demande moyenne',
  HIGH: 'Demande forte',
};

export const COMPETITION_LEVEL_LABELS: Record<MarketLevel, string> = {
  LOW: 'Peu de vendeurs',
  MEDIUM: 'Concurrence moyenne',
  HIGH: 'Beaucoup de vendeurs',
};

/** Risque global de l'opportunité : qualité, casse, invendus, conformité. */
export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const RiskLevelSchema = z.enum(RISK_LEVELS);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW: 'Risque faible',
  MEDIUM: 'Risque moyen',
  HIGH: 'Risque élevé',
};

/** Facilité de transport Chine → Cameroun (poids, volume, restrictions). */
export const TRANSPORT_EASES = ['EASY', 'MODERATE', 'DIFFICULT'] as const;
export const TransportEaseSchema = z.enum(TRANSPORT_EASES);
export type TransportEase = z.infer<typeof TransportEaseSchema>;

export const TRANSPORT_EASE_LABELS: Record<TransportEase, string> = {
  EASY: 'Transport facile',
  MODERATE: 'Transport moyen',
  DIFFICULT: 'Transport contraignant',
};

/**
 * Badges produit. Chacun correspond à un fait vérifiable, jamais à une promesse
 * commerciale : la description dit précisément ce qui a été constaté (§45, §54).
 */
export const PRODUCT_BADGES = [
  'LOW_MOQ',
  'LIGHT_WEIGHT',
  'SMALL_VOLUME',
  'SAMPLE_AVAILABLE',
  'CUSTOMIZABLE',
  'VERIFIED_SUPPLIER',
  'FRAGILE',
  'BATTERY',
] as const;
export const ProductBadgeSchema = z.enum(PRODUCT_BADGES);
export type ProductBadge = z.infer<typeof ProductBadgeSchema>;

export const PRODUCT_BADGE_LABELS: Record<ProductBadge, { label: string; description: string }> = {
  LOW_MOQ: { label: 'Petite quantité', description: 'Le fournisseur accepte une commande de 50 pièces ou moins.' },
  LIGHT_WEIGHT: { label: 'Léger', description: 'Moins de 500 g par pièce : le fret pèse peu dans le coût rendu.' },
  SMALL_VOLUME: { label: 'Peu encombrant', description: 'Moins de 2 000 cm³ par pièce, facile à grouper.' },
  SAMPLE_AVAILABLE: { label: 'Échantillon possible', description: 'Le fournisseur accepte d’envoyer un échantillon payant.' },
  CUSTOMIZABLE: { label: 'Personnalisable', description: 'Logo ou packaging à votre marque possibles.' },
  VERIFIED_SUPPLIER: { label: 'Fournisseur contrôlé', description: 'Au moins un fournisseur lié a passé une vérification enregistrée.' },
  FRAGILE: { label: 'Fragile', description: 'Casse possible : emballage renforcé et inspection recommandés.' },
  BATTERY: { label: 'Contient une batterie', description: 'Transport aérien restreint : le maritime est souvent imposé.' },
};

/** Onglets de l'écran Opportunités (§12). La description explique la règle de classement. */
export const CATALOG_TABS = [
  'FOR_YOU',
  'TRENDING',
  'NEW',
  'LOW_BUDGET',
  'HIGH_MARGIN',
  'LOW_COMPETITION',
] as const;
export const CatalogTabSchema = z.enum(CATALOG_TABS);
export type CatalogTab = z.infer<typeof CatalogTabSchema>;

export const CATALOG_TAB_LABELS: Record<CatalogTab, { label: string; description: string }> = {
  FOR_YOU: {
    label: 'Pour vous',
    description: 'Classés selon le budget et les catégories indiqués dans votre profil.',
  },
  TRENDING: {
    label: 'Tendances',
    description: 'Produits dont la demande locale relevée est la plus forte, relevé le plus récent d’abord.',
  },
  NEW: { label: 'Nouveautés', description: 'Produits publiés le plus récemment.' },
  LOW_BUDGET: {
    label: 'Faible budget',
    description: 'Investissement minimum estimé le plus bas, quantité minimum comprise.',
  },
  HIGH_MARGIN: {
    label: 'Forte marge',
    description: 'Marge estimée la plus élevée, calculée à partir d’un prix local réellement relevé.',
  },
  LOW_COMPETITION: {
    label: 'Faible concurrence',
    description: 'Produits pour lesquels nous avons relevé le moins de vendeurs sur le marché local.',
  },
};

// ───────────────────────── Hypothèses de calcul (§20, §21) ─────────────────────────

export const CostAssumptionSchema = z.object({
  label: z.string(),
  detail: z.string(),
  source: z.string(),
  observedAt: z.iso.datetime(),
});
export type CostAssumption = z.infer<typeof CostAssumptionSchema>;

/**
 * Hypothèses du coût rendu affiché dans le catalogue, tant que les grilles tarifaires
 * du lot CARGO ne sont pas saisies. Ordres de grandeur relevés le 20/09/2026
 * (docs/taches.md §3) : ils sont affichés tels quels, datés, et jamais présentés comme un tarif ferme.
 */
export const CATALOG_COST_ASSUMPTIONS = {
  /** ≈ 3,4 USD/kg en période de pointe, converti à 615 FCFA pour 1 USD. */
  airFreightXafPerKg: 2_100,
  /** Frais de service Warrior Sourcing appliqués à la valeur marchandise. */
  serviceFeePercent: 5,
  /** Droits et taxes à l'importation : ordre de grandeur, à confirmer au cas par cas. */
  customsPercent: 20,
  observedAt: '2026-09-20T00:00:00.000Z',
} as const;

export const CATALOG_COST_ASSUMPTION_LIST: CostAssumption[] = [
  {
    label: 'Fret aérien',
    detail: `${CATALOG_COST_ASSUMPTIONS.airFreightXafPerKg.toLocaleString('fr-FR')} FCFA par kilo transporté`,
    source: 'Ordre de grandeur relevé auprès de transitaires, à confirmer',
    observedAt: CATALOG_COST_ASSUMPTIONS.observedAt,
  },
  {
    label: 'Frais de service',
    detail: `${CATALOG_COST_ASSUMPTIONS.serviceFeePercent} % de la valeur marchandise`,
    source: 'Grille interne Warrior Sourcing',
    observedAt: CATALOG_COST_ASSUMPTIONS.observedAt,
  },
  {
    label: 'Droits et taxes',
    detail: `${CATALOG_COST_ASSUMPTIONS.customsPercent} % de la marchandise et du fret`,
    source: 'Ordre de grandeur, à confirmer selon la position tarifaire du produit',
    observedAt: CATALOG_COST_ASSUMPTIONS.observedAt,
  },
];

/** Phrase affichée partout où un résultat de simulation apparaît (§14). */
export const ESTIMATE_WARNING =
  'Ces chiffres sont une estimation calculée à partir des hypothèses ci-dessus. Ce n’est ni un devis, ni une promesse de gain : le tarif réel du transitaire, les droits de douane et le prix de vente réel peuvent différer.';

// ───────────────────────── Blocs de réponse ─────────────────────────

/** Prix d'achat en Chine, avec le taux daté qui a servi à la conversion (§20). */
export const PurchasePriceSchema = z.object({
  amountMinor: z.number().int(),
  currency: CurrencySchema,
  /** Même montant converti en FCFA entiers. */
  amountXaf: z.number().int(),
  exchangeRate: z.number(),
  exchangeRateObservedAt: z.iso.datetime(),
  exchangeRateSource: z.string(),
});

/** Prix local observé : une fourchette, sa date et sa source. Jamais l'un sans les autres (§13). */
export const ObservedLocalPriceSchema = z.object({
  minXaf: z.number().int(),
  maxXaf: z.number().int(),
  observedAt: z.iso.datetime(),
  source: z.string(),
  provenance: DataProvenanceSchema,
});
export type ObservedLocalPrice = z.infer<typeof ObservedLocalPriceSchema>;

/** Appréciation du marché : chaque valeur peut manquer, la date est obligatoire. */
export const MarketAssessmentSchema = z.object({
  demand: MarketLevelSchema.nullable(),
  demandLabel: z.string().nullable(),
  competition: MarketLevelSchema.nullable(),
  competitionLabel: z.string().nullable(),
  risk: RiskLevelSchema.nullable(),
  riskLabel: z.string().nullable(),
  transportEase: TransportEaseSchema.nullable(),
  transportEaseLabel: z.string().nullable(),
  /** Capital jugé nécessaire pour se lancer sur ce produit, en FCFA. */
  capitalRequiredXaf: z.number().int().nullable(),
  assessedAt: z.iso.datetime(),
  source: z.string(),
  provenance: DataProvenanceSchema,
});
export type MarketAssessment = z.infer<typeof MarketAssessmentSchema>;

/** Détail du coût rendu estimé pour une quantité donnée. */
export const LandedCostEstimateSchema = z.object({
  quantity: z.number().int(),
  merchandiseXaf: z.number().int(),
  freightXaf: z.number().int(),
  serviceFeeXaf: z.number().int(),
  customsXaf: z.number().int(),
  totalXaf: z.number().int(),
  unitXaf: z.number().int(),
  provenance: z.literal('ESTIMATE'),
  assumptions: z.array(CostAssumptionSchema),
});
export type LandedCostEstimate = z.infer<typeof LandedCostEstimateSchema>;

/** Marge potentielle : toujours adossée à un prix local daté, sinon absente. */
export const PotentialMarginSchema = z.object({
  /** Prix de vente retenu : borne basse de la fourchette relevée, par prudence. */
  unitSellingPriceXaf: z.number().int(),
  unitLandedCostXaf: z.number().int(),
  unitMarginXaf: z.number().int(),
  /** Marge rapportée au coût rendu, en pourcentage arrondi. */
  marginPercent: z.number(),
  basedOnPriceObservedAt: z.iso.datetime(),
  basedOnPriceSource: z.string(),
  provenance: z.literal('ESTIMATE'),
});
export type PotentialMargin = z.infer<typeof PotentialMarginSchema>;

export const ProductImageSchema = z.object({
  url: z.string(),
  alt: z.string(),
});

/** Carte compacte de l'écran Opportunités (§12). */
export const CatalogProductCardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: InterestCategorySchema,
  categoryLabel: z.string(),
  image: ProductImageSchema.nullable(),
  purchasePrice: PurchasePriceSchema,
  moq: z.number().int(),
  weightGrams: z.number().int(),
  volumeCm3: z.number().int().nullable(),
  badges: z.array(ProductBadgeSchema),
  /** Coût rendu estimé pour la quantité minimum : c'est le ticket d'entrée. */
  minimumOrder: LandedCostEstimateSchema,
  localPrice: ObservedLocalPriceSchema.nullable(),
  potentialMargin: PotentialMarginSchema.nullable(),
  market: MarketAssessmentSchema.nullable(),
  publishedAt: z.iso.datetime(),
});
export type CatalogProductCard = z.infer<typeof CatalogProductCardSchema>;

/** Fiche produit complète (§13). */
export const CatalogProductDetailSchema = CatalogProductCardSchema.extend({
  description: z.string(),
  images: z.array(ProductImageSchema),
  /** Points de vigilance rédigés par l'équipe : ce qui peut mal se passer. */
  watchPoints: z.array(z.string()),
  /** Identifiants des fournisseurs liés. Leur fiche est servie par le lot SUP. */
  supplierIds: z.array(z.string()),
  costAssumptions: z.array(CostAssumptionSchema),
  estimateWarning: z.string(),
});
export type CatalogProductDetail = z.infer<typeof CatalogProductDetailSchema>;

// ───────────────────────── Requêtes ─────────────────────────

/**
 * Filtres et pagination de la liste. Les valeurs arrivent en texte dans l'URL :
 * elles sont converties ici, une seule fois, pour le serveur comme pour le client.
 */
export const CatalogQuerySchema = z.object({
  tab: CatalogTabSchema.default('FOR_YOU'),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(48).default(12),
  /** Budget total disponible : écarte les produits dont la commande minimum coûte plus cher. */
  budgetMaxXaf: z.coerce.number().int().positive().optional(),
  moqMax: z.coerce.number().int().positive().optional(),
  /** Marge estimée minimum, en pourcentage du coût rendu. */
  marginMinPercent: z.coerce.number().int().min(0).max(1000).optional(),
  /** Risque maximum accepté : `LOW` ne garde que le risque faible. */
  riskMax: RiskLevelSchema.optional(),
  weightMaxGrams: z.coerce.number().int().positive().optional(),
  category: InterestCategorySchema.optional(),
  transportEase: TransportEaseSchema.optional(),
});
export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;

export const InvestmentSimulationRequestSchema = z.object({
  /** Budget disponible en FCFA entiers. */
  budgetXaf: z.number().int().positive(),
});
export type InvestmentSimulationRequest = z.infer<typeof InvestmentSimulationRequestSchema>;

// ───────────────────────── Réponses ─────────────────────────

export const CatalogListResponseSchema = z.object({
  tab: CatalogTabSchema,
  tabLabel: z.string(),
  tabDescription: z.string(),
  /** Vrai seulement si un profil d'importateur a réellement servi au classement (§CAT-04). */
  personalized: z.boolean(),
  /** Explique en français ce qui a produit ce classement, ou ce qui manque pour le personnaliser. */
  personalizationNote: z.string(),
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  items: z.array(CatalogProductCardSchema),
});
export type CatalogListResponse = z.infer<typeof CatalogListResponseSchema>;

export const CatalogProductResponseSchema = z.object({
  product: CatalogProductDetailSchema,
});
export type CatalogProductResponse = z.infer<typeof CatalogProductResponseSchema>;

/** Simulateur d'investissement (§14). Le résultat est une estimation, l'avertissement l'accompagne. */
export const InvestmentSimulationResponseSchema = z.object({
  provenance: z.literal('ESTIMATE'),
  warning: z.string(),
  productId: z.string(),
  productName: z.string(),
  budgetXaf: z.number().int(),
  /** Quantité achetable avec ce budget, jamais inférieure à la quantité minimum. */
  quantity: z.number().int(),
  /** Vrai si le budget ne couvre même pas la commande minimum : le reste est affiché à titre indicatif. */
  belowMinimumOrder: z.boolean(),
  totalInvestmentXaf: z.number().int(),
  unitLandedCostXaf: z.number().int(),
  remainingBudgetXaf: z.number().int(),
  cost: LandedCostEstimateSchema,
  /** Absent tant qu'aucun prix local daté n'a été relevé : on n'invente pas de chiffre d'affaires. */
  sale: z
    .object({
      unitSellingPriceXaf: z.number().int(),
      potentialRevenueXaf: z.number().int(),
      totalMarginXaf: z.number().int(),
      unitMarginXaf: z.number().int(),
      roiPercent: z.number(),
      breakEvenUnits: z.number().int().nullable(),
      basedOnPriceObservedAt: z.iso.datetime(),
      basedOnPriceSource: z.string(),
    })
    .nullable(),
  /** Raison lisible quand `sale` vaut null. */
  saleUnavailableReason: z.string().nullable(),
  assumptions: z.array(CostAssumptionSchema),
});
export type InvestmentSimulationResponse = z.infer<typeof InvestmentSimulationResponseSchema>;
