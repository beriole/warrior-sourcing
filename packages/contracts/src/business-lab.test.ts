import { describe, expect, it } from 'vitest';
import { computeBusinessMetrics, describeBusinessProgress } from './business-lab.js';

/**
 * Indicateurs du Business Lab (LAB-02).
 *
 * Les chiffres sont recalculés à la main dans chaque cas : un test qui reprendrait la
 * formule du code ne prouverait que sa propre cohérence.
 */
const PROJET = { capitalXaf: 240_000, quantity: 100, targetUnitPriceXaf: 3_500 };

describe('computeBusinessMetrics', () => {
  it('reste à zéro tant qu’aucune vente n’est saisie', () => {
    const metrics = computeBusinessMetrics(PROJET, []);

    expect(metrics.soldQuantity).toBe(0);
    expect(metrics.revenueXaf).toBe(0);
    expect(metrics.remainingQuantity).toBe(100);
    // Aucun prix moyen : il n'y a rien dont faire la moyenne.
    expect(metrics.averageUnitPriceXaf).toBeNull();
    expect(metrics.capitalRecoveredPercent).toBe(0);
    expect(metrics.capitalRemainingXaf).toBe(240_000);
  });

  it('mesure la marge sur les unités vendues, pas sur le lot entier', () => {
    // 30 unités à 3 500 = 105 000 encaissés. Coût unitaire : 240 000 / 100 = 2 400.
    // Coût des 30 vendues : 72 000. Marge constatée : 105 000 − 72 000 = 33 000.
    const metrics = computeBusinessMetrics(PROJET, [{ quantity: 30, unitPriceXaf: 3_500 }]);

    expect(metrics.revenueXaf).toBe(105_000);
    expect(metrics.unitCostXaf).toBe(2_400);
    expect(metrics.soldCostXaf).toBe(72_000);
    expect(metrics.marginXaf).toBe(33_000);
    expect(metrics.remainingQuantity).toBe(70);
  });

  it('calcule le ROI sur le capital engagé, pas sur la part déjà vendue', () => {
    // 33 000 de marge sur 240 000 immobilisés = 14 %. C'est bien tout l'argent engagé
    // qui doit être rémunéré, même si une partie du lot dort encore.
    const metrics = computeBusinessMetrics(PROJET, [{ quantity: 30, unitPriceXaf: 3_500 }]);
    expect(metrics.roiPercent).toBe(14);
  });

  it('agrège plusieurs ventes à des prix différents', () => {
    const metrics = computeBusinessMetrics(PROJET, [
      { quantity: 20, unitPriceXaf: 4_000 },
      { quantity: 10, unitPriceXaf: 3_000 },
    ]);

    // 80 000 + 30 000 = 110 000 sur 30 unités → 3 666,67, arrondi à 3 667.
    expect(metrics.revenueXaf).toBe(110_000);
    expect(metrics.soldQuantity).toBe(30);
    expect(metrics.averageUnitPriceXaf).toBe(3_667);
  });

  it('suit la récupération du capital et ce qu’il reste à vendre pour y arriver', () => {
    const metrics = computeBusinessMetrics(PROJET, [{ quantity: 50, unitPriceXaf: 3_500 }]);

    // 175 000 encaissés sur 240 000 → 73 %. Reste 65 000, soit 19 unités à 3 500.
    expect(metrics.capitalRecoveredPercent).toBe(73);
    expect(metrics.capitalRemainingXaf).toBe(65_000);
    expect(metrics.unitsToBreakEven).toBe(19);
    expect(metrics.capitalRecovered).toBe(false);
  });

  it('annonce le capital récupéré dès que les encaissements le couvrent', () => {
    const metrics = computeBusinessMetrics(PROJET, [{ quantity: 70, unitPriceXaf: 3_500 }]);

    // 245 000 encaissés : le capital de 240 000 est couvert.
    expect(metrics.capitalRecovered).toBe(true);
    expect(metrics.capitalRemainingXaf).toBe(0);
    expect(metrics.capitalRecoveredPercent).toBe(100);
    // Plus rien à vendre pour rembourser : la question ne se pose plus.
    expect(metrics.unitsToBreakEven).toBeNull();
  });

  it('compte une marge négative telle quelle, sans la masquer', () => {
    // 40 unités bradées à 1 000 : 40 000 encaissés pour 96 000 de coût.
    const metrics = computeBusinessMetrics(PROJET, [{ quantity: 40, unitPriceXaf: 1_000 }]);

    expect(metrics.marginXaf).toBe(-56_000);
    expect(metrics.roiPercent).toBe(-23);
  });

  it('signale une saisie supérieure au lot au lieu de l’absorber', () => {
    const metrics = computeBusinessMetrics(PROJET, [{ quantity: 120, unitPriceXaf: 3_000 }]);

    expect(metrics.oversold).toBe(true);
    // Le reste ne devient jamais négatif : « −20 unités » n'aurait aucun sens à l'écran.
    expect(metrics.remainingQuantity).toBe(0);
  });

  it('plafonne la part de capital récupérée à 100 %', () => {
    const metrics = computeBusinessMetrics(PROJET, [{ quantity: 100, unitPriceXaf: 5_000 }]);
    expect(metrics.capitalRecoveredPercent).toBe(100);
  });
});

describe('describeBusinessProgress', () => {
  it('dit l’absence de vente plutôt que d’afficher une phrase creuse', () => {
    const phrase = describeBusinessProgress(computeBusinessMetrics(PROJET, []));
    expect(phrase).toContain('Aucune vente saisie');
  });

  it('indique combien d’unités restent pour rembourser le capital', () => {
    const phrase = describeBusinessProgress(
      computeBusinessMetrics(PROJET, [{ quantity: 50, unitPriceXaf: 3_500 }]),
    );
    expect(phrase).toContain('50 unités à vendre');
    expect(phrase).toContain('19');
  });

  it('annonce que tout ce qui rentre est du bénéfice une fois le capital couvert', () => {
    const phrase = describeBusinessProgress(
      computeBusinessMetrics(PROJET, [{ quantity: 70, unitPriceXaf: 3_500 }]),
    );
    expect(phrase).toContain('Capital récupéré');
  });

  it('nomme une perte sans l’enrober', () => {
    const phrase = describeBusinessProgress(
      computeBusinessMetrics(PROJET, [{ quantity: 100, unitPriceXaf: 1_000 }]),
    );
    expect(phrase).toContain('perte');
  });

  it('signale une saisie incohérente avant toute autre chose', () => {
    const phrase = describeBusinessProgress(
      computeBusinessMetrics(PROJET, [{ quantity: 120, unitPriceXaf: 3_000 }]),
    );
    expect(phrase).toContain('vérifiez la quantité');
  });
});
