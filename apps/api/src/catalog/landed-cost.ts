import {
  CATALOG_COST_ASSUMPTION_LIST,
  CATALOG_COST_ASSUMPTIONS,
  computeLandedCost,
  type LandedCostEstimate,
  type LandedCostInput,
  type LandedCostResult,
} from '@ws/contracts';

/**
 * Coût rendu estimé d'un produit du catalogue (§20, §21).
 *
 * Le moteur de calcul lui-même vit dans `@ws/contracts` (computeLandedCost) : on ne le
 * réécrit pas, on se contente de construire ses entrées à partir des hypothèses publiées.
 * Tant que les grilles tarifaires du lot CARGO ne sont pas saisies, le fret repose sur
 * l'ordre de grandeur daté de `CATALOG_COST_ASSUMPTIONS`, affiché avec le résultat.
 */
export interface CostableProduct {
  /** Prix d'achat unitaire déjà converti en FCFA entiers. */
  purchasePriceXaf: number;
  /** Poids unitaire en grammes. */
  weightGrams: number;
}

/** Construit l'entrée du moteur partagé pour une quantité donnée. */
function buildInput(
  product: CostableProduct,
  quantity: number,
  unitSellingPriceXaf?: number,
): LandedCostInput {
  const merchandise = product.purchasePriceXaf * quantity;
  const freight = Math.ceil(
    ((product.weightGrams * quantity) / 1000) * CATALOG_COST_ASSUMPTIONS.airFreightXafPerKg,
  );
  const serviceFee = Math.round((merchandise * CATALOG_COST_ASSUMPTIONS.serviceFeePercent) / 100);
  const customsEstimate = Math.round(
    ((merchandise + freight) * CATALOG_COST_ASSUMPTIONS.customsPercent) / 100,
  );

  return {
    quantity,
    unitPurchasePrice: product.purchasePriceXaf,
    freight,
    serviceFee,
    customsEstimate,
    unitSellingPrice: unitSellingPriceXaf,
  };
}

/** Détail du coût rendu, prêt à être renvoyé par l'API avec ses hypothèses. */
export function estimateLandedCost(product: CostableProduct, quantity: number): LandedCostEstimate {
  const input = buildInput(product, quantity);
  const result = computeLandedCost(input);

  return {
    quantity,
    merchandiseXaf: result.merchandiseCost,
    freightXaf: result.freight,
    // `otherCosts` regroupe service et douane : on les reprend depuis l'entrée pour les détailler.
    serviceFeeXaf: input.serviceFee ?? 0,
    customsXaf: input.customsEstimate ?? 0,
    totalXaf: result.totalCost,
    unitXaf: result.unitLandedCost,
    provenance: 'ESTIMATE',
    assumptions: CATALOG_COST_ASSUMPTION_LIST,
  };
}

/** Même calcul, en ajoutant un prix de vente pour obtenir marge, ROI et seuil de rentabilité. */
export function estimateWithSale(
  product: CostableProduct,
  quantity: number,
  unitSellingPriceXaf: number,
): LandedCostResult {
  return computeLandedCost(buildInput(product, quantity, unitSellingPriceXaf));
}

/**
 * Quantité achetable avec un budget donné.
 * Le coût rendu unitaire est proportionnel à la quantité : une division suffit.
 */
export function quantityForBudget(product: CostableProduct, budgetXaf: number): number {
  const unitCost = estimateLandedCost(product, 1).unitXaf;
  if (unitCost <= 0) return 0;
  return Math.floor(budgetXaf / unitCost);
}
