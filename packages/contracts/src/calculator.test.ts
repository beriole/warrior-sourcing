import { describe, expect, it } from 'vitest';
import { computeLandedCost, unitsLeftToRecoverCapital } from './calculator.js';

describe('computeLandedCost', () => {
  it('additionne tous les postes et calcule le coût rendu unitaire', () => {
    const result = computeLandedCost({
      quantity: 100,
      unitPurchasePrice: 1_500,
      chinaInlandTransport: 5_000,
      inspection: 10_000,
      freight: 35_000,
      packaging: 2_000,
      otherCosts: [{ label: 'Dédouanement transitaire', amount: 3_000 }],
    });

    expect(result.merchandiseCost).toBe(150_000);
    expect(result.otherCosts).toBe(5_000);
    expect(result.totalCost).toBe(205_000);
    expect(result.unitLandedCost).toBe(2_050);
    expect(result.selling).toBeNull();
  });

  it('calcule marge, ROI et seuil de rentabilité avec un prix de vente', () => {
    const result = computeLandedCost({ quantity: 100, unitPurchasePrice: 2_000, unitSellingPrice: 3_000 });

    expect(result.selling).toEqual({
      unitSellingPrice: 3_000,
      revenue: 300_000,
      unitMargin: 1_000,
      totalMargin: 100_000,
      roi: 0.5,
      breakEvenUnits: 67,
    });
  });

  it("n'annonce pas de seuil si le prix ne couvre jamais le coût", () => {
    const result = computeLandedCost({ quantity: 10, unitPurchasePrice: 2_000, unitSellingPrice: 1_500 });

    expect(result.selling?.breakEvenUnits).toBeNull();
    expect(result.selling?.totalMargin).toBe(-5_000);
  });

  it('arrondit le coût unitaire vers le haut pour ne jamais le sous-estimer', () => {
    expect(computeLandedCost({ quantity: 3, unitPurchasePrice: 0, freight: 10 }).unitLandedCost).toBe(4);
  });
});

describe('unitsLeftToRecoverCapital', () => {
  it('retourne le nombre d’unités restant à vendre', () => {
    expect(unitsLeftToRecoverCapital({ totalCost: 200_000, revenueSoFar: 120_000, unitSellingPrice: 3_000 })).toBe(27);
  });

  it('retourne 0 quand le capital est récupéré', () => {
    expect(unitsLeftToRecoverCapital({ totalCost: 200_000, revenueSoFar: 250_000, unitSellingPrice: 3_000 })).toBe(0);
  });
});
