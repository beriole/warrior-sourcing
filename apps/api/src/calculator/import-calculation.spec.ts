import {
  computeFallbackFreight,
  computeFreightCharge,
  computeImportCalculation,
  computeShipmentMeasures,
  selectFreightRate,
  type FreightRate,
  type Parcel,
} from '@ws/contracts';
import { describe, expect, it } from 'vitest';

/**
 * Moteur d'importation (CALC-01) : un test par poste de coût et sur le poids volumétrique.
 * Les tarifs de fret utilisés ici sont fabriqués pour le test : le moteur ne connaît
 * aucun prix par lui-même (CALC-02).
 */

/** Deux cartons de 10 kg, 60 × 40 × 30 cm : 0,144 m³ au total. */
const PARCELS: Parcel[] = [
  { cartons: 2, weightKgPerCarton: 10, lengthCm: 60, widthCm: 40, heightCm: 30 },
];

const AIR_RATE: FreightRate = {
  mode: 'AIR',
  unit: 'KG',
  unitPriceXaf: 2_000,
  minimumChargeXaf: 0,
  weightBreakKg: 0,
  transitDays: 12,
  effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
  source: 'Devis du 01/06/2026',
  forwarderId: 'tr-1',
  forwarderName: 'Cargo Douala',
};

describe('poids volumétrique et mesures', () => {
  it('applique le diviseur aérien (6000) et retient le poids le plus élevé', () => {
    const measures = computeShipmentMeasures(PARCELS, 'AIR');

    expect(measures.cartons).toBe(2);
    expect(measures.realWeightKg).toBe(20);
    expect(measures.volumeM3).toBe(0.144);
    expect(measures.volumetricWeightKg).toBe(24);
    expect(measures.chargeableWeightKg).toBe(24);
  });

  it('applique le diviseur express (5000), plus sévère que l’aérien', () => {
    expect(computeShipmentMeasures(PARCELS, 'EXPRESS').volumetricWeightKg).toBe(28.8);
    expect(computeShipmentMeasures(PARCELS, 'EXPRESS').chargeableWeightKg).toBe(28.8);
  });

  it('garde le poids réel quand il dépasse le poids volumétrique', () => {
    const dense: Parcel[] = [
      { cartons: 1, weightKgPerCarton: 80, lengthCm: 40, widthCm: 30, heightCm: 20 },
    ];
    const measures = computeShipmentMeasures(dense, 'AIR');

    expect(measures.volumetricWeightKg).toBe(4);
    expect(measures.chargeableWeightKg).toBe(80);
  });

  it('renvoie des mesures nulles sans carton déclaré', () => {
    expect(computeShipmentMeasures([], 'SEA')).toMatchObject({ cartons: 0, chargeableWeightKg: 0 });
  });
});

describe('tarif appliqué', () => {
  it('facture au kilo facturable', () => {
    const charge = computeFreightCharge(AIR_RATE, computeShipmentMeasures(PARCELS, 'AIR'));

    expect(charge.chargeableQuantity).toBe(24);
    expect(charge.amountXaf).toBe(48_000);
    expect(charge.minimumApplied).toBe(false);
  });

  it('applique le minimum facturé quand le calcul reste en dessous', () => {
    const charge = computeFreightCharge(
      { ...AIR_RATE, minimumChargeXaf: 60_000 },
      computeShipmentMeasures(PARCELS, 'AIR'),
    );

    expect(charge.amountXaf).toBe(60_000);
    expect(charge.minimumApplied).toBe(true);
  });

  it('facture au mètre cube en maritime', () => {
    const charge = computeFreightCharge(
      { ...AIR_RATE, mode: 'SEA', unit: 'CBM', unitPriceXaf: 120_000 },
      computeShipmentMeasures(PARCELS, 'SEA'),
    );

    expect(charge.chargeableQuantity).toBe(0.144);
    expect(charge.amountXaf).toBe(17_280);
  });

  it('choisit le bon palier, ignore les grilles pas encore en vigueur, garde la plus récente', () => {
    const at = new Date('2026-09-20T00:00:00.000Z');
    const rates: FreightRate[] = [
      { ...AIR_RATE, unitPriceXaf: 2_600, weightBreakKg: 0, effectiveFrom: new Date('2026-01-01') },
      { ...AIR_RATE, unitPriceXaf: 2_200, weightBreakKg: 20, effectiveFrom: new Date('2026-01-01') },
      { ...AIR_RATE, unitPriceXaf: 2_000, weightBreakKg: 20, effectiveFrom: new Date('2026-06-01') },
      { ...AIR_RATE, unitPriceXaf: 1_500, weightBreakKg: 20, effectiveFrom: new Date('2027-01-01') },
    ];

    expect(selectFreightRate(rates, { mode: 'AIR', chargeableWeightKg: 24, at })?.unitPriceXaf).toBe(2_000);
    expect(selectFreightRate(rates, { mode: 'AIR', chargeableWeightKg: 10, at })?.unitPriceXaf).toBe(2_600);
    expect(selectFreightRate(rates, { mode: 'SEA', chargeableWeightKg: 24, at })).toBeNull();
  });
});

describe('repli sans transitaire (CALC-02)', () => {
  it('renvoie une fourchette datée et marquée « estimation »', () => {
    const fallback = computeFallbackFreight('SEA', computeShipmentMeasures(PARCELS, 'SEA'));

    expect(fallback.origin).toBe('FALLBACK');
    expect(fallback.provenance).toBe('ESTIMATE');
    expect(fallback.range).toEqual({ lowXaf: 12_960, highXaf: 25_920 });
    // On retient le haut de la fourchette : le budget annoncé ne doit pas être dépassé.
    expect(fallback.amountXaf).toBe(25_920);
    expect(fallback.transitDaysRange).toEqual({ min: 35, max: 50 });
    expect(fallback.source).toContain('20/09/2026');
  });

  it('bascule sur le repli quand le calcul n’a aucune grille', () => {
    const result = computeImportCalculation({
      quantity: 10,
      unitPurchasePrice: 5_000,
      mode: 'AIR',
      parcels: PARCELS,
    });

    expect(result.freight.origin).toBe('FALLBACK');
    expect(result.freight.provenance).toBe('ESTIMATE');
    // 24 kg facturables × 2 600 FCFA, haut de fourchette.
    expect(result.costs.freight).toBe(62_400);
  });

  it('préfère le montant saisi à la main à la fourchette de repli', () => {
    const result = computeImportCalculation({
      quantity: 10,
      unitPurchasePrice: 5_000,
      mode: 'AIR',
      parcels: PARCELS,
      freightOverride: 40_000,
    });

    expect(result.freight.origin).toBe('MANUAL');
    expect(result.costs.freight).toBe(40_000);
  });
});

describe('calcul complet, poste par poste', () => {
  const result = computeImportCalculation(
    {
      quantity: 100,
      unitPurchasePrice: 2_000,
      mode: 'AIR',
      parcels: PARCELS,
      chinaInlandTransport: 5_000,
      inspection: 10_000,
      packaging: 3_000,
      insuranceRatePercent: 1,
      serviceFeePercent: 5,
      customsDutyPercent: 10,
      vatPercent: 19.25,
      otherCosts: [{ label: 'Dédouanement transitaire', amount: 4_000 }],
      unitSellingPrice: 6_000,
    },
    { rate: AIR_RATE, at: new Date('2026-09-20T10:00:00.000Z') },
  );

  it('retient la grille du transitaire, avec sa date et sa source', () => {
    expect(result.freight.origin).toBe('TARIFF');
    expect(result.freight.provenance).toBe('VERIFIED');
    expect(result.freight.forwarderName).toBe('Cargo Douala');
    expect(result.freight.effectiveFrom).toBe('2026-06-01T00:00:00.000Z');
    expect(result.freight.transitDays).toBe(12);
    expect(result.freight.source).toBe('Devis du 01/06/2026');
  });

  it('calcule la marchandise et le transport interne Chine', () => {
    expect(result.costs.merchandise).toBe(200_000);
    expect(result.costs.chinaInlandTransport).toBe(5_000);
  });

  it('reprend l’inspection et le packaging tels que saisis', () => {
    expect(result.costs.inspection).toBe(10_000);
    expect(result.costs.packaging).toBe(3_000);
  });

  it('calcule l’assurance en pourcentage de la marchandise', () => {
    expect(result.costs.insurance).toBe(2_000);
  });

  it('calcule le fret depuis la grille', () => {
    expect(result.costs.freight).toBe(48_000);
  });

  it('calcule les frais de service en pourcentage', () => {
    expect(result.costs.serviceFee).toBe(10_000);
  });

  it('calcule les taxes estimatives sur la valeur CAF', () => {
    expect(result.customsValue).toBe(250_000);
    expect(result.costs.customsDuty).toBe(25_000);
    expect(result.costs.vat).toBe(52_938);
    expect(result.costs.taxes).toBe(77_938);
  });

  it('additionne les coûts personnalisés', () => {
    expect(result.costs.otherCosts).toBe(4_000);
  });

  it('totalise et arrondit le coût unitaire vers le haut', () => {
    expect(result.costs.total).toBe(359_938);
    expect(result.unitLandedCost).toBe(3_600);
  });

  it('calcule marge, ROI et seuil de rentabilité', () => {
    expect(result.selling).toMatchObject({
      revenue: 600_000,
      unitMargin: 2_400,
      totalMargin: 240_062,
      breakEvenUnits: 60,
    });
  });
});
