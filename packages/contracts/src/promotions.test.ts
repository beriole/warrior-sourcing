import { describe, expect, it } from 'vitest';
import {
  applyPromotion,
  bestPromotion,
  discountLabel,
  priceWithoutPromotion,
  type ApplicablePromotion,
} from './promotions.js';

/**
 * Calcul des remises.
 *
 * Chaque montant attendu est recalculé à la main : un test qui reprendrait la formule du
 * code ne prouverait que sa propre cohérence.
 */
function promotion(partial: Partial<ApplicablePromotion> = {}): ApplicablePromotion {
  return {
    id: 'promo-1',
    name: 'Promotion de test',
    kind: 'PERCENTAGE',
    percentage: 30,
    amountXaf: null,
    code: null,
    endsAt: null,
    maxRedemptions: null,
    redemptionCount: 0,
    minimumAmountXaf: null,
    ...partial,
  };
}

describe('applyPromotion', () => {
  it('rend le prix inchangé sans promotion', () => {
    const prix = applyPromotion(25_000, null);
    expect(prix.finalXaf).toBe(25_000);
    expect(prix.discountXaf).toBe(0);
    expect(prix.promotionId).toBeNull();
  });

  it('retire un pourcentage, arrondi en faveur du client', () => {
    // 30 % de 25 000 = 7 500 exactement.
    expect(applyPromotion(25_000, promotion({ percentage: 30 })).finalXaf).toBe(17_500);
    // 30 % de 9 999 = 2 999,7 → la remise est arrondie au franc supérieur, soit 3 000,
    // et le client paie 6 999 : l'arrondi lui profite.
    expect(applyPromotion(9_999, promotion({ percentage: 30 })).finalXaf).toBe(6_999);
  });

  it('retire un montant fixe', () => {
    const prix = applyPromotion(25_000, promotion({ kind: 'AMOUNT', percentage: null, amountXaf: 5_000 }));
    expect(prix.finalXaf).toBe(20_000);
    expect(prix.discountPercent).toBe(20);
  });

  it('impose un prix promotionnel', () => {
    const prix = applyPromotion(25_000, promotion({ kind: 'FIXED_PRICE', percentage: null, amountXaf: 9_900 }));
    expect(prix.finalXaf).toBe(9_900);
    expect(prix.discountXaf).toBe(15_100);
    // 15 100 / 25 000 = 60,4 % → 60 %.
    expect(prix.discountPercent).toBe(60);
  });

  it('rend l’article offert', () => {
    const prix = applyPromotion(25_000, promotion({ kind: 'FREE', percentage: null }));
    expect(prix.finalXaf).toBe(0);
    expect(prix.free).toBe(true);
    expect(discountLabel(prix)).toBe('Offert');
  });

  it('ne descend jamais sous zéro', () => {
    // Une remise de 40 000 sur un prix de 25 000 ne crée pas d'avoir.
    const prix = applyPromotion(25_000, promotion({ kind: 'AMOUNT', percentage: null, amountXaf: 40_000 }));
    expect(prix.finalXaf).toBe(0);
    expect(prix.discountXaf).toBe(25_000);
  });

  it('ne remonte jamais au-dessus du prix de la fiche', () => {
    // Un « prix promotionnel » plus cher que le prix courant ne s'applique pas : ce
    // serait une fausse remise (§54).
    const prix = applyPromotion(10_000, promotion({ kind: 'FIXED_PRICE', percentage: null, amountXaf: 30_000 }));
    expect(prix.finalXaf).toBe(10_000);
    expect(prix.discountXaf).toBe(0);
  });

  it('ignore la promotion sous le montant minimum exigé', () => {
    const offre = promotion({ minimumAmountXaf: 20_000 });
    expect(applyPromotion(15_000, offre).finalXaf).toBe(15_000);
    expect(applyPromotion(20_000, offre).finalXaf).toBe(14_000);
  });

  it('n’annonce un reste que si un quota existe réellement', () => {
    expect(applyPromotion(25_000, promotion()).remainingRedemptions).toBeNull();

    const limitee = applyPromotion(25_000, promotion({ maxRedemptions: 50, redemptionCount: 47 }));
    expect(limitee.remainingRedemptions).toBe(3);
  });

  it('ne descend pas sous zéro utilisation restante', () => {
    const epuisee = applyPromotion(25_000, promotion({ maxRedemptions: 10, redemptionCount: 12 }));
    expect(epuisee.remainingRedemptions).toBe(0);
  });

  it('reporte la date de fin telle quelle, sans en inventer', () => {
    expect(applyPromotion(25_000, promotion()).promotionEndsAt).toBeNull();
    const datee = applyPromotion(25_000, promotion({ endsAt: '2026-12-31T23:00:00.000Z' }));
    expect(datee.promotionEndsAt).toBe('2026-12-31T23:00:00.000Z');
  });

  it('traite un article déjà gratuit sans produire de pourcentage absurde', () => {
    const prix = applyPromotion(0, promotion({ percentage: 50 }));
    expect(prix.finalXaf).toBe(0);
    // Pas de division par zéro déguisée en « 100 % de remise ».
    expect(prix.discountPercent).toBe(0);
    expect(discountLabel(prix)).toBeNull();
  });
});

describe('bestPromotion', () => {
  it('retient la plus avantageuse pour le client, sans cumuler', () => {
    const choisie = bestPromotion(25_000, [
      promotion({ id: 'pourcentage', percentage: 20 }),
      promotion({ id: 'montant', kind: 'AMOUNT', percentage: null, amountXaf: 8_000 }),
      promotion({ id: 'prix-fixe', kind: 'FIXED_PRICE', percentage: null, amountXaf: 19_900 }),
    ]);
    // 20 % → 20 000 ; −8 000 → 17 000 ; prix fixe → 19 900. La meilleure est le montant.
    expect(choisie?.id).toBe('montant');
    expect(applyPromotion(25_000, choisie).finalXaf).toBe(17_000);
  });

  it('ne retient rien quand aucune promotion n’améliore le prix', () => {
    const choisie = bestPromotion(10_000, [
      promotion({ kind: 'FIXED_PRICE', percentage: null, amountXaf: 12_000 }),
      promotion({ minimumAmountXaf: 50_000 }),
    ]);
    expect(choisie).toBeNull();
  });

  it('rend null sur une liste vide', () => {
    expect(bestPromotion(10_000, [])).toBeNull();
  });
});

describe('priceWithoutPromotion', () => {
  it('annonce gratuit un article dont le prix est nul', () => {
    expect(priceWithoutPromotion(0).free).toBe(true);
    expect(priceWithoutPromotion(1).free).toBe(false);
  });
});
