import { z } from 'zod';
import { FreightUnitSchema, ImportCalculationInputSchema } from './calculator.js';
import { ShippingModeSchema } from './logistics.js';
import { DataProvenanceSchema } from './provenance.js';

/**
 * Transitaires et grilles tarifaires (lot CARGO) et calculateur d'importation (lot CALC).
 *
 * Schémas de requête et de réponse de ces lots. Les décrire ici permet au serveur de typer
 * ses contrôleurs et au client du site d'être généré à partir du même contrat.
 * Ne rien écrire ici qui appartienne à un autre lot.
 */

const xaf = z.number().int().nonnegative();

// ───────────────────────── Requêtes d'administration (CARGO-01, CARGO-02) ─────────────────────────

export const CreateForwarderRequestSchema = z.object({
  name: z.string().min(2, 'Le nom du transitaire est obligatoire.').max(120),
  contactName: z.string().max(120).optional(),
  contactPhone: z.string().max(40).optional(),
  contactEmail: z.email('Adresse email invalide.').optional(),
  /** Villes desservies au Cameroun (Douala, Yaoundé…). */
  cities: z.array(z.string().min(1)).default([]),
  modes: z.array(ShippingModeSchema).min(1, 'Indiquez au moins un mode de transport.'),
  notes: z.string().max(2_000).optional(),

  /**
   * Entrepôt de groupage en Chine (§25).
   *
   * C'est l'adresse que l'importateur donnera à son fournisseur. Elle est saisie ici et
   * nulle part ailleurs : l'assistant d'adresse l'assemble, il ne l'invente pas. Un
   * transitaire sans `warehouseAddressZh` n'est tout simplement pas proposé.
   */
  warehouseName: z.string().max(140).optional(),
  /** Adresse en caractères chinois : c'est celle que le transporteur local lit. */
  warehouseAddressZh: z.string().max(400).optional(),
  /** Même adresse en lettres latines, pour relire la saisie. Jamais servie seule. */
  warehouseAddressLatin: z.string().max(400).optional(),
  warehouseContactName: z.string().max(140).optional(),
  warehousePhone: z.string().max(40).optional(),
  warehouseInstructions: z.string().max(2_000).optional(),
});
export type CreateForwarderRequest = z.input<typeof CreateForwarderRequestSchema>;

export const UpdateForwarderRequestSchema = CreateForwarderRequestSchema.partial().extend({
  /** Désactivation : le transitaire reste en base et son historique de tarifs avec lui. */
  active: z.boolean().optional(),
});
export type UpdateForwarderRequest = z.input<typeof UpdateForwarderRequestSchema>;

export const CreateFreightRateRequestSchema = z.object({
  mode: ShippingModeSchema,
  unit: FreightUnitSchema,
  unitPriceXaf: z.number().int().positive('Le prix unitaire doit être supérieur à zéro.'),
  minimumChargeXaf: xaf.default(0),
  /** Palier : la grille s'applique à partir de ce poids facturable, en kilos. */
  weightBreakKg: z.number().int().nonnegative().default(0),
  transitDays: z.number().int().positive('Le délai annoncé doit être d’au moins un jour.'),
  /** Date d'entrée en vigueur, au format ISO (« 2026-06-01 » ou date complète). */
  effectiveFrom: z
    .union([z.iso.datetime(), z.iso.date()], { error: 'Indiquez une date valide.' })
    .transform((value) => new Date(value)),
  source: z.string().min(2, 'Indiquez la source du tarif (devis, email, appel…).').max(300),
});
export type CreateFreightRateRequest = z.input<typeof CreateFreightRateRequestSchema>;
/** Même grille, après validation : la date est alors une vraie Date (côté serveur). */
export type CreateFreightRateData = z.output<typeof CreateFreightRateRequestSchema>;

/**
 * Une grille n'est jamais modifiée : elle est remplacée par une nouvelle, datée.
 * Seule sa mise hors service reste possible.
 */
export const UpdateFreightRateRequestSchema = z.object({ active: z.boolean() });
export type UpdateFreightRateRequest = z.input<typeof UpdateFreightRateRequestSchema>;

export const ForwarderSearchQuerySchema = z.object({
  recherche: z.string().max(120).optional(),
  mode: ShippingModeSchema.optional(),
  ville: z.string().max(120).optional(),
  actif: z.enum(['oui', 'non', 'tous']).default('oui'),
});
export type ForwarderSearchQuery = z.input<typeof ForwarderSearchQuerySchema>;

// ───────────────────────── Réponses (CARGO-03) ─────────────────────────

export const FreightRateResponseSchema = z.object({
  id: z.string(),
  forwarderId: z.string(),
  mode: ShippingModeSchema,
  unit: FreightUnitSchema,
  unitPriceXaf: z.number().int(),
  minimumChargeXaf: z.number().int(),
  weightBreakKg: z.number().int(),
  transitDays: z.number().int(),
  effectiveFrom: z.iso.datetime(),
  source: z.string(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type FreightRateResponse = z.infer<typeof FreightRateResponseSchema>;

export const ForwarderResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  contactName: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  cities: z.array(z.string()),
  modes: z.array(ShippingModeSchema),
  active: z.boolean(),
  notes: z.string().nullable(),
  warehouseName: z.string().nullable(),
  warehouseAddressZh: z.string().nullable(),
  warehouseAddressLatin: z.string().nullable(),
  warehouseContactName: z.string().nullable(),
  warehousePhone: z.string().nullable(),
  warehouseInstructions: z.string().nullable(),
  /** Vrai quand l'adresse chinoise est renseignée : seul cas où l'assistant le propose. */
  hasWarehouseAddress: z.boolean(),
  /** Nombre de grilles enregistrées, historique compris. */
  rateCount: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ForwarderResponse = z.infer<typeof ForwarderResponseSchema>;

export const ForwarderListResponseSchema = z.object({
  forwarders: z.array(ForwarderResponseSchema),
  total: z.number().int(),
});
export type ForwarderListResponse = z.infer<typeof ForwarderListResponseSchema>;

/** Détail d'un transitaire : toutes ses grilles, de la plus récente à la plus ancienne. */
export const ForwarderDetailResponseSchema = z.object({
  forwarder: ForwarderResponseSchema,
  rates: z.array(FreightRateResponseSchema),
});
export type ForwarderDetailResponse = z.infer<typeof ForwarderDetailResponseSchema>;

// ───────────────────────── Options du calculateur (CARGO-05) ─────────────────────────

export const CargoOptionResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  cities: z.array(z.string()),
  modes: z.array(ShippingModeSchema),
  /** Grilles en vigueur aujourd'hui, une par mode et par palier. */
  rates: z.array(FreightRateResponseSchema),
});

export const CargoOptionsResponseSchema = z.object({
  forwarders: z.array(CargoOptionResponseSchema),
  /** Fourchettes utilisées quand aucun transitaire n'est choisi. Toujours « estimation ». */
  fallback: z.object({
    provenance: DataProvenanceSchema,
    observedAt: z.string(),
    source: z.string(),
    ranges: z.array(
      z.object({
        mode: ShippingModeSchema,
        unit: FreightUnitSchema,
        lowXaf: z.number().int(),
        highXaf: z.number().int(),
        transitDaysMin: z.number().int(),
        transitDaysMax: z.number().int(),
      }),
    ),
  }),
});
export type CargoOptionsResponse = z.infer<typeof CargoOptionsResponseSchema>;

// ───────────────────────── Calculateur (CALC-01, CALC-04) ─────────────────────────

export const ShipmentMeasuresResponseSchema = z.object({
  cartons: z.number().int(),
  realWeightKg: z.number(),
  volumeM3: z.number(),
  volumetricWeightKg: z.number(),
  chargeableWeightKg: z.number(),
});

export const FreightOutcomeResponseSchema = z.object({
  unit: FreightUnitSchema,
  chargeableQuantity: z.number(),
  amountXaf: z.number().int(),
  minimumApplied: z.boolean(),
  origin: z.enum(['TARIFF', 'MANUAL', 'FALLBACK']),
  provenance: DataProvenanceSchema,
  forwarderId: z.string().nullable(),
  forwarderName: z.string().nullable(),
  rateId: z.string().nullable(),
  effectiveFrom: z.iso.datetime().nullable(),
  transitDays: z.number().int().nullable(),
  transitDaysRange: z.object({ min: z.number().int(), max: z.number().int() }).nullable(),
  range: z.object({ lowXaf: z.number().int(), highXaf: z.number().int() }).nullable(),
  source: z.string(),
});

export const ImportCalculationResultSchema = z.object({
  mode: ShippingModeSchema,
  quantity: z.number().int(),
  measures: ShipmentMeasuresResponseSchema,
  freight: FreightOutcomeResponseSchema,
  costs: z.object({
    merchandise: z.number().int(),
    chinaInlandTransport: z.number().int(),
    inspection: z.number().int(),
    packaging: z.number().int(),
    insurance: z.number().int(),
    freight: z.number().int(),
    serviceFee: z.number().int(),
    customsDuty: z.number().int(),
    vat: z.number().int(),
    taxes: z.number().int(),
    otherCosts: z.number().int(),
    total: z.number().int(),
  }),
  customsValue: z.number().int(),
  unitLandedCost: z.number().int(),
  selling: z
    .object({
      unitSellingPrice: z.number().int(),
      revenue: z.number().int(),
      unitMargin: z.number().int(),
      totalMargin: z.number().int(),
      roi: z.number(),
      breakEvenUnits: z.number().int().nullable(),
    })
    .nullable(),
  computedAt: z.iso.datetime(),
});
export type ImportCalculationResultResponse = z.infer<typeof ImportCalculationResultSchema>;

/**
 * Le calcul du mode demandé, plus les deux autres modes pour la comparaison
 * aérien / maritime / express côte à côte (CALC-04).
 */
export const ImportCalculationResponseSchema = z.object({
  provenance: z.literal('ESTIMATE'),
  result: ImportCalculationResultSchema,
  comparison: z.array(ImportCalculationResultSchema),
});
export type ImportCalculationResponse = z.infer<typeof ImportCalculationResponseSchema>;

// ───────────────────────── Simulations sauvegardées (CALC-05) ─────────────────────────

export const SaveSimulationRequestSchema = z.object({
  label: z.string().min(2, 'Donnez un nom à votre simulation.').max(120),
  input: ImportCalculationInputSchema,
});
export type SaveSimulationRequest = z.input<typeof SaveSimulationRequestSchema>;

export const SimulationSummaryResponseSchema = z.object({
  id: z.string(),
  label: z.string(),
  mode: ShippingModeSchema,
  forwarderName: z.string().nullable(),
  quantity: z.number().int(),
  totalXaf: z.number().int(),
  unitLandedCostXaf: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SimulationSummaryResponse = z.infer<typeof SimulationSummaryResponseSchema>;

export const SimulationResponseSchema = SimulationSummaryResponseSchema.extend({
  /** Entrée d'origine : elle permet de reprendre ou de dupliquer la simulation. */
  input: z.unknown(),
  result: ImportCalculationResultSchema,
});
export type SimulationResponse = z.infer<typeof SimulationResponseSchema>;

export const SimulationListResponseSchema = z.object({
  simulations: z.array(SimulationSummaryResponseSchema),
  total: z.number().int(),
});
export type SimulationListResponse = z.infer<typeof SimulationListResponseSchema>;
