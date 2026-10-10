import { z } from 'zod';
import { ShippingModeSchema, type ShippingMode } from './logistics.js';
import type { DataProvenance } from './provenance.js';

/**
 * Cahier §14, §20, §21 : calculateur d'importation et simulateur.
 * Tous les montants d'entrée et de sortie sont en FCFA entiers (déjà convertis avec un taux daté).
 * Le résultat est toujours une ESTIMATION, jamais une garantie.
 */
const xaf = z.number().int().nonnegative();

export const LandedCostInputSchema = z.object({
  quantity: z.number().int().positive(),
  unitPurchasePrice: xaf,
  chinaInlandTransport: xaf.default(0),
  inspection: xaf.default(0),
  packaging: xaf.default(0),
  insurance: xaf.default(0),
  freight: xaf.default(0),
  serviceFee: xaf.default(0),
  customsEstimate: xaf.default(0),
  otherCosts: z
    .array(z.object({ label: z.string().min(1), amount: xaf }))
    .default([]),
  /** Prix de vente unitaire saisi par l'utilisateur, optionnel. */
  unitSellingPrice: xaf.optional(),
});
export type LandedCostInput = z.input<typeof LandedCostInputSchema>;

export interface LandedCostResult {
  merchandiseCost: number;
  chinaInlandTransport: number;
  inspection: number;
  freight: number;
  otherCosts: number;
  totalCost: number;
  /** Coût rendu unitaire, arrondi à l'entier supérieur pour ne jamais sous-estimer. */
  unitLandedCost: number;
  selling: null | {
    unitSellingPrice: number;
    revenue: number;
    unitMargin: number;
    totalMargin: number;
    /** Ratio (0.25 = 25 %). */
    roi: number;
    /** Unités à vendre pour récupérer l'investissement ; null si le prix ne couvre jamais le coût. */
    breakEvenUnits: number | null;
  };
}

export function computeLandedCost(rawInput: LandedCostInput): LandedCostResult {
  const input = LandedCostInputSchema.parse(rawInput);

  const merchandiseCost = input.unitPurchasePrice * input.quantity;
  const otherCosts =
    input.packaging +
    input.insurance +
    input.serviceFee +
    input.customsEstimate +
    input.otherCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const totalCost =
    merchandiseCost + input.chinaInlandTransport + input.inspection + input.freight + otherCosts;
  const unitLandedCost = Math.ceil(totalCost / input.quantity);

  let selling: LandedCostResult['selling'] = null;
  if (input.unitSellingPrice !== undefined) {
    const revenue = input.unitSellingPrice * input.quantity;
    const totalMargin = revenue - totalCost;
    selling = {
      unitSellingPrice: input.unitSellingPrice,
      revenue,
      unitMargin: input.unitSellingPrice - unitLandedCost,
      totalMargin,
      roi: totalCost === 0 ? 0 : totalMargin / totalCost,
      breakEvenUnits:
        input.unitSellingPrice > 0 && input.unitSellingPrice * input.quantity >= totalCost
          ? Math.ceil(totalCost / input.unitSellingPrice)
          : null,
    };
  }

  return {
    merchandiseCost,
    chinaInlandTransport: input.chinaInlandTransport,
    inspection: input.inspection,
    freight: input.freight,
    otherCosts,
    totalCost,
    unitLandedCost,
    selling,
  };
}

/** Cahier §27 : message utile du Business Lab. */
export function unitsLeftToRecoverCapital(params: {
  totalCost: number;
  revenueSoFar: number;
  unitSellingPrice: number;
}): number {
  const remaining = params.totalCost - params.revenueSoFar;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / params.unitSellingPrice);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot CALC-01 / CALC-02 : moteur complet d'importation.
// Poids et dimensions, poids volumétrique, trois modes de transport, postes de
// coût détaillés, taxes estimatives et coûts personnalisés.
// Aucun tarif de fret n'est codé en dur : il vient des grilles saisies (lot CARGO).
// ─────────────────────────────────────────────────────────────────────────────

/** Pourcentage saisi par l'utilisateur (ce n'est pas un montant : le flottant est permis). */
const percent = z.number().min(0).max(100);

export const FREIGHT_UNITS = ['KG', 'CBM'] as const;
export const FreightUnitSchema = z.enum(FREIGHT_UNITS);
export type FreightUnit = z.infer<typeof FreightUnitSchema>;

export const FREIGHT_UNIT_LABELS: Record<FreightUnit, string> = {
  KG: 'le kilo',
  CBM: 'le mètre cube',
};

/**
 * Diviseurs de poids volumétrique (cm³ par kilo facturé), usage courant des transitaires.
 * Le maritime est facturé au mètre cube : son diviseur ne sert que si un transitaire
 * publie malgré tout une grille au kilo.
 */
export const VOLUMETRIC_DIVISORS: Record<ShippingMode, number> = {
  AIR: 6_000,
  EXPRESS: 5_000,
  SEA: 6_000,
};

/** Un lot de cartons identiques. Les poids et dimensions ne sont pas de l'argent. */
export const ParcelSchema = z.object({
  cartons: z.number().int().positive().default(1),
  weightKgPerCarton: z.number().positive(),
  lengthCm: z.number().positive(),
  widthCm: z.number().positive(),
  heightCm: z.number().positive(),
});
export type Parcel = z.input<typeof ParcelSchema>;

export interface ShipmentMeasures {
  cartons: number;
  /** Poids réel total, en kilos. */
  realWeightKg: number;
  /** Volume total, en mètres cubes. */
  volumeM3: number;
  /** Poids volumétrique du mode choisi, en kilos. */
  volumetricWeightKg: number;
  /** Poids facturable : le plus élevé du réel et du volumétrique. */
  chargeableWeightKg: number;
}

/** Arrondi d'affichage des mesures (3 décimales) : ni argent, ni fausse précision. */
function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

/** Poids réel, volume, poids volumétrique et poids facturable d'un envoi. */
export function computeShipmentMeasures(rawParcels: Parcel[], mode: ShippingMode): ShipmentMeasures {
  const parcels = z.array(ParcelSchema).parse(rawParcels);
  const divisor = VOLUMETRIC_DIVISORS[mode];

  let cartons = 0;
  let realWeightKg = 0;
  let volumeCm3 = 0;

  for (const parcel of parcels) {
    cartons += parcel.cartons;
    realWeightKg += parcel.cartons * parcel.weightKgPerCarton;
    volumeCm3 += parcel.cartons * parcel.lengthCm * parcel.widthCm * parcel.heightCm;
  }

  const volumetricWeightKg = volumeCm3 / divisor;

  return {
    cartons,
    realWeightKg: round3(realWeightKg),
    volumeM3: round3(volumeCm3 / 1_000_000),
    volumetricWeightKg: round3(volumetricWeightKg),
    chargeableWeightKg: round3(Math.max(realWeightKg, volumetricWeightKg)),
  };
}

/**
 * Une ligne de grille tarifaire telle que l'administration la saisit (CARGO-02).
 * Le moteur ne connaît que cette forme : il ignore d'où elle vient.
 */
export const FreightRateSchema = z.object({
  id: z.string().optional(),
  forwarderId: z.string().optional(),
  forwarderName: z.string().optional(),
  mode: ShippingModeSchema,
  unit: FreightUnitSchema,
  unitPriceXaf: z.number().int().positive(),
  minimumChargeXaf: xaf.default(0),
  /** Palier : la ligne s'applique à partir de ce poids facturable, en kilos. */
  weightBreakKg: z.number().nonnegative().default(0),
  transitDays: z.number().int().positive(),
  effectiveFrom: z.coerce.date(),
  source: z.string().min(1),
});
export type FreightRate = z.infer<typeof FreightRateSchema>;

/**
 * Choisit la ligne applicable : bon mode, déjà entrée en vigueur, palier atteint.
 * À égalité de palier, la grille la plus récente l'emporte — l'ancienne reste en base,
 * elle n'est jamais écrasée (CARGO-02).
 */
export function selectFreightRate(
  rates: FreightRate[],
  params: { mode: ShippingMode; chargeableWeightKg: number; at?: Date },
): FreightRate | null {
  const at = params.at ?? new Date();

  const eligible = rates.filter(
    (rate) =>
      rate.mode === params.mode &&
      rate.effectiveFrom.getTime() <= at.getTime() &&
      rate.weightBreakKg <= params.chargeableWeightKg,
  );
  if (eligible.length === 0) return null;

  return eligible.reduce((best, rate) => {
    if (rate.weightBreakKg !== best.weightBreakKg) {
      return rate.weightBreakKg > best.weightBreakKg ? rate : best;
    }
    return rate.effectiveFrom.getTime() > best.effectiveFrom.getTime() ? rate : best;
  });
}

export interface FreightCharge {
  unit: FreightUnit;
  /** Quantité facturée : kilos facturables ou mètres cubes. */
  chargeableQuantity: number;
  amountXaf: number;
  /** Vrai si le minimum de facturation a pris le dessus sur le calcul au tarif. */
  minimumApplied: boolean;
}

/** Coût du fret pour une grille donnée. Arrondi à l'entier supérieur : jamais sous-estimé. */
export function computeFreightCharge(rate: FreightRate, measures: ShipmentMeasures): FreightCharge {
  const chargeableQuantity = rate.unit === 'KG' ? measures.chargeableWeightKg : measures.volumeM3;
  const computed = Math.ceil(chargeableQuantity * rate.unitPriceXaf);
  const amountXaf = Math.max(computed, rate.minimumChargeXaf);

  return {
    unit: rate.unit,
    chargeableQuantity: round3(chargeableQuantity),
    amountXaf,
    minimumApplied: amountXaf > computed,
  };
}

/**
 * Repli quand aucun transitaire n'est renseigné (CALC-02).
 * Ce ne sont pas des tarifs : ce sont des ordres de grandeur, toujours présentés
 * comme une fourchette marquée « estimation », avec leur date et leur source.
 * Relevés dans docs/taches.md §3 le 20/09/2026, à confirmer auprès d'un transitaire.
 */
export const FREIGHT_FALLBACK_SOURCE =
  'Ordres de grandeur relevés le 20/09/2026 (docs/taches.md §3), à confirmer auprès d’un transitaire camerounais';
export const FREIGHT_FALLBACK_OBSERVED_AT = '2026-09-20';

export const FREIGHT_FALLBACK_RANGES: Record<
  ShippingMode,
  {
    unit: FreightUnit;
    lowXaf: number;
    highXaf: number;
    transitDaysMin: number;
    transitDaysMax: number;
  }
> = {
  AIR: { unit: 'KG', lowXaf: 1_800, highXaf: 2_600, transitDaysMin: 7, transitDaysMax: 15 },
  SEA: { unit: 'CBM', lowXaf: 90_000, highXaf: 180_000, transitDaysMin: 35, transitDaysMax: 50 },
  EXPRESS: { unit: 'KG', lowXaf: 4_000, highXaf: 7_000, transitDaysMin: 3, transitDaysMax: 7 },
};

export interface FreightOutcome extends FreightCharge {
  /** D'où vient le montant : grille saisie, saisie manuelle, ou fourchette de repli. */
  origin: 'TARIFF' | 'MANUAL' | 'FALLBACK';
  provenance: DataProvenance;
  forwarderId: string | null;
  forwarderName: string | null;
  rateId: string | null;
  /** Date d'entrée en vigueur du tarif appliqué (ISO), null hors grille saisie. */
  effectiveFrom: string | null;
  transitDays: number | null;
  transitDaysRange: { min: number; max: number } | null;
  /** Fourchette affichée quand le montant est un repli, null sinon. */
  range: { lowXaf: number; highXaf: number } | null;
  source: string;
}

/** Fourchette de repli calculée sur les mesures de l'envoi. */
export function computeFallbackFreight(
  mode: ShippingMode,
  measures: ShipmentMeasures,
): FreightOutcome {
  const range = FREIGHT_FALLBACK_RANGES[mode];
  const chargeableQuantity = range.unit === 'KG' ? measures.chargeableWeightKg : measures.volumeM3;
  const lowXaf = Math.ceil(chargeableQuantity * range.lowXaf);
  const highXaf = Math.ceil(chargeableQuantity * range.highXaf);

  return {
    unit: range.unit,
    chargeableQuantity: round3(chargeableQuantity),
    // On retient le haut de la fourchette : mieux vaut une bonne surprise qu'un budget dépassé.
    amountXaf: highXaf,
    minimumApplied: false,
    origin: 'FALLBACK',
    provenance: 'ESTIMATE',
    forwarderId: null,
    forwarderName: null,
    rateId: null,
    effectiveFrom: null,
    transitDays: null,
    transitDaysRange: { min: range.transitDaysMin, max: range.transitDaysMax },
    range: { lowXaf, highXaf },
    source: FREIGHT_FALLBACK_SOURCE,
  };
}

export const ImportCalculationInputSchema = z.object({
  quantity: z.number().int().positive(),
  unitPurchasePrice: xaf,
  mode: ShippingModeSchema,
  /** Cartons de l'envoi. Sans carton, le fret ne peut venir que d'une saisie manuelle. */
  parcels: z.array(ParcelSchema).default([]),
  /** Transitaire choisi (CARGO-05) : le serveur va chercher sa grille en vigueur. */
  forwarderId: z.string().optional(),
  /** Fret saisi à la main : passe avant la fourchette de repli, jamais avant une grille. */
  freightOverride: xaf.optional(),
  chinaInlandTransport: xaf.default(0),
  inspection: xaf.default(0),
  packaging: xaf.default(0),
  insurance: xaf.default(0),
  /** Assurance en pourcentage de la valeur marchandise, cumulable avec le montant fixe. */
  insuranceRatePercent: percent.default(0),
  serviceFee: xaf.default(0),
  serviceFeePercent: percent.default(0),
  /** Taxes estimatives : droits de douane et TVA sur la valeur CAF. */
  customsDutyPercent: percent.default(0),
  vatPercent: percent.default(0),
  customsFixed: xaf.default(0),
  otherCosts: z.array(z.object({ label: z.string().min(1), amount: xaf })).default([]),
  unitSellingPrice: xaf.optional(),
});
export type ImportCalculationInput = z.input<typeof ImportCalculationInputSchema>;

export interface ImportCalculationResult {
  mode: ShippingMode;
  quantity: number;
  measures: ShipmentMeasures;
  freight: FreightOutcome;
  costs: {
    merchandise: number;
    chinaInlandTransport: number;
    inspection: number;
    packaging: number;
    insurance: number;
    freight: number;
    serviceFee: number;
    customsDuty: number;
    vat: number;
    taxes: number;
    otherCosts: number;
    total: number;
  };
  /** Valeur CAF ayant servi d'assiette aux taxes estimatives. */
  customsValue: number;
  unitLandedCost: number;
  selling: LandedCostResult['selling'];
  computedAt: string;
}

/**
 * Moteur complet. Le fret vient, dans cet ordre : de la grille fournie par le serveur,
 * du montant saisi à la main, puis de la fourchette de repli marquée « estimation ».
 */
export function computeImportCalculation(
  rawInput: ImportCalculationInput,
  options: { rate?: FreightRate | null; at?: Date } = {},
): ImportCalculationResult {
  const input = ImportCalculationInputSchema.parse(rawInput);
  const at = options.at ?? new Date();
  const measures = computeShipmentMeasures(input.parcels, input.mode);

  let freight: FreightOutcome;
  if (options.rate) {
    const rate = FreightRateSchema.parse(options.rate);
    const charge = computeFreightCharge(rate, measures);
    freight = {
      ...charge,
      origin: 'TARIFF',
      // La grille a été saisie par l'administration, avec sa date et sa source.
      provenance: 'VERIFIED',
      forwarderId: rate.forwarderId ?? null,
      forwarderName: rate.forwarderName ?? null,
      rateId: rate.id ?? null,
      effectiveFrom: rate.effectiveFrom.toISOString(),
      transitDays: rate.transitDays,
      transitDaysRange: null,
      range: null,
      source: rate.source,
    };
  } else if (input.freightOverride !== undefined) {
    freight = {
      unit: input.mode === 'SEA' ? 'CBM' : 'KG',
      chargeableQuantity: input.mode === 'SEA' ? measures.volumeM3 : measures.chargeableWeightKg,
      amountXaf: input.freightOverride,
      minimumApplied: false,
      origin: 'MANUAL',
      provenance: 'ESTIMATE',
      forwarderId: null,
      forwarderName: null,
      rateId: null,
      effectiveFrom: null,
      transitDays: null,
      transitDaysRange: null,
      range: null,
      source: 'Montant que vous avez saisi',
    };
  } else {
    freight = computeFallbackFreight(input.mode, measures);
  }

  const merchandise = input.unitPurchasePrice * input.quantity;
  const insurance = input.insurance + Math.ceil((merchandise * input.insuranceRatePercent) / 100);
  const serviceFee = input.serviceFee + Math.ceil((merchandise * input.serviceFeePercent) / 100);

  // Valeur CAF : marchandise + fret + assurance, assiette habituelle des droits de douane.
  const customsValue = merchandise + freight.amountXaf + insurance;
  const customsDuty = Math.ceil((customsValue * input.customsDutyPercent) / 100);
  const vat = Math.ceil(((customsValue + customsDuty) * input.vatPercent) / 100);
  const taxes = customsDuty + vat + input.customsFixed;

  // Totaux et marge restent calculés par computeLandedCost : une seule règle, testée une fois.
  const landed = computeLandedCost({
    quantity: input.quantity,
    unitPurchasePrice: input.unitPurchasePrice,
    chinaInlandTransport: input.chinaInlandTransport,
    inspection: input.inspection,
    packaging: input.packaging,
    insurance,
    freight: freight.amountXaf,
    serviceFee,
    customsEstimate: taxes,
    otherCosts: input.otherCosts,
    unitSellingPrice: input.unitSellingPrice,
  });

  return {
    mode: input.mode,
    quantity: input.quantity,
    measures,
    freight,
    costs: {
      merchandise,
      chinaInlandTransport: input.chinaInlandTransport,
      inspection: input.inspection,
      packaging: input.packaging,
      insurance,
      freight: freight.amountXaf,
      serviceFee,
      customsDuty,
      vat,
      taxes,
      otherCosts: input.otherCosts.reduce((sum, cost) => sum + cost.amount, 0),
      total: landed.totalCost,
    },
    customsValue,
    unitLandedCost: landed.unitLandedCost,
    selling: landed.selling,
    computedAt: at.toISOString(),
  };
}
