import { describe, expect, it } from 'vitest';
import {
  PERSONALIZATION_POINTS,
  budgetBounds,
  rankForProfile,
  scoreForProfile,
  type PersonalizableProduct,
  type PersonalizationProfile,
} from './personalization.js';

/** Produit de test : uniquement les faits qui entrent dans la règle. */
function product(overrides: Partial<PersonalizableProduct> & { id: string }): PersonalizableProduct {
  return {
    category: 'PHONES',
    minimumOrderTotalXaf: 150_000,
    marginPercent: null,
    risk: null,
    ...overrides,
  };
}

const petitBudget: PersonalizationProfile = {
  budgetRange: 'FROM_100K_TO_300K',
  interests: ['PHONES', 'ACCESSORIES'],
};

const grosBudget: PersonalizationProfile = {
  budgetRange: 'FROM_1M_TO_5M',
  interests: ['MACHINES'],
};

describe('Personnalisation « Pour vous » (CAT-04)', () => {
  it('récompense une catégorie choisie à l’inscription', () => {
    const suivi = scoreForProfile(product({ id: 'a', category: 'PHONES' }), petitBudget);
    const horsInteret = scoreForProfile(product({ id: 'b', category: 'MACHINES' }), petitBudget);

    expect(suivi - horsInteret).toBe(PERSONALIZATION_POINTS.matchingInterest);
  });

  it('écarte ce que le budget déclaré ne couvre pas', () => {
    const accessible = scoreForProfile(product({ id: 'a', minimumOrderTotalXaf: 250_000 }), petitBudget);
    const horsBudget = scoreForProfile(product({ id: 'b', minimumOrderTotalXaf: 2_000_000 }), petitBudget);

    expect(accessible).toBeGreaterThan(horsBudget);
    expect(accessible - horsBudget).toBe(
      PERSONALIZATION_POINTS.affordable + PERSONALIZATION_POINTS.usesBudget - PERSONALIZATION_POINTS.tooExpensive,
    );
  });

  it('plafonne le bonus de marge et pénalise le risque élevé', () => {
    const margeEnorme = scoreForProfile(product({ id: 'a', marginPercent: 900 }), petitBudget);
    // 40 % de marge valent 8 points (40 / 5) ; 900 % restent plafonnés au bonus maximum.
    const margeCorrecte = scoreForProfile(product({ id: 'b', marginPercent: 40 }), petitBudget);
    expect(margeEnorme - margeCorrecte).toBe(PERSONALIZATION_POINTS.maxMarginBonus - 8);

    const risqué = scoreForProfile(product({ id: 'c', risk: 'HIGH' }), petitBudget);
    const sûr = scoreForProfile(product({ id: 'd', risk: 'LOW' }), petitBudget);
    expect(sûr - risqué).toBe(PERSONALIZATION_POINTS.lowRisk - PERSONALIZATION_POINTS.highRisk);
  });

  it('ignore une marge absente au lieu de lui inventer une valeur', () => {
    const sansDonnée = scoreForProfile(product({ id: 'a', marginPercent: null }), petitBudget);
    const margeNulle = scoreForProfile(product({ id: 'b', marginPercent: 0 }), petitBudget);

    expect(sansDonnée).toBe(margeNulle);
  });

  it('donne deux classements différents à deux profils différents', () => {
    const catalogue = [
      product({ id: 'coque', category: 'PHONES', minimumOrderTotalXaf: 180_000 }),
      product({ id: 'machine', category: 'MACHINES', minimumOrderTotalXaf: 2_400_000 }),
      product({ id: 'sac', category: 'FASHION', minimumOrderTotalXaf: 260_000 }),
    ];

    const pourPetitBudget = rankForProfile(catalogue, petitBudget).map((item) => item.id);
    const pourGrosBudget = rankForProfile(catalogue, grosBudget).map((item) => item.id);

    expect(pourPetitBudget[0]).toBe('coque');
    expect(pourGrosBudget[0]).toBe('machine');
    expect(pourPetitBudget).not.toEqual(pourGrosBudget);
  });

  it('classe de façon stable : à égalité, l’identifiant tranche', () => {
    const catalogue = [product({ id: 'zeta' }), product({ id: 'alpha' })];

    expect(rankForProfile(catalogue, petitBudget).map((item) => item.id)).toEqual(['alpha', 'zeta']);
    expect(rankForProfile([...catalogue].reverse(), petitBudget).map((item) => item.id)).toEqual(['alpha', 'zeta']);
  });

  it('traite la tranche la plus haute comme un budget sans plafond', () => {
    expect(budgetBounds('OVER_5M').max).toBe(Number.POSITIVE_INFINITY);
    expect(budgetBounds('UNDER_100K')).toEqual({ min: 0, max: 100_000 });
  });
});
