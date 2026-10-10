import { BUDGET_RANGES, type BudgetRangeId, type InterestCategory, type RiskLevel } from '@ws/contracts';

/**
 * Personnalisation de l'onglet « Pour vous » (§12, CAT-04).
 *
 * La règle est une fonction pure, testée unitairement : elle croise le profil
 * d'importateur (`importer_profile` : budget et centres d'intérêt) avec des faits du
 * catalogue. Aucune donnée n'est inventée, aucun produit n'est masqué : seul l'ordre change.
 */
export interface PersonalizationProfile {
  budgetRange: BudgetRangeId;
  interests: InterestCategory[];
}

export interface PersonalizableProduct {
  id: string;
  category: InterestCategory;
  /** Coût rendu estimé de la commande minimum : le ticket d'entrée réel. */
  minimumOrderTotalXaf: number;
  /** Marge estimée en pourcentage du coût rendu, `null` si aucun prix local n'a été relevé. */
  marginPercent: number | null;
  risk: RiskLevel | null;
}

/** Points attribués par la règle. Regroupés ici pour que le test les cite explicitement. */
export const PERSONALIZATION_POINTS = {
  /** Le produit appartient à une catégorie cochée à l'inscription. */
  matchingInterest: 50,
  /** La commande minimum tient dans le budget annoncé. */
  affordable: 30,
  /** Elle exploite au moins le plancher de la tranche : le budget n'est pas sous-employé. */
  usesBudget: 10,
  /** La commande minimum dépasse le budget annoncé : le produit passe derrière. */
  tooExpensive: -40,
  /** Bonus de marge, plafonné pour qu'une marge élevée ne fasse pas oublier le budget. */
  maxMarginBonus: 20,
  lowRisk: 10,
  highRisk: -10,
} as const;

const RISK_POINTS: Record<RiskLevel, number> = {
  LOW: PERSONALIZATION_POINTS.lowRisk,
  MEDIUM: 0,
  HIGH: PERSONALIZATION_POINTS.highRisk,
};

/** Bornes en FCFA de la tranche de budget déclarée ; `Infinity` quand elle est sans plafond. */
export function budgetBounds(budgetRange: BudgetRangeId): { min: number; max: number } {
  const range = BUDGET_RANGES.find((candidate) => candidate.id === budgetRange);
  if (!range) return { min: 0, max: Number.POSITIVE_INFINITY };
  return { min: range.min, max: range.max ?? Number.POSITIVE_INFINITY };
}

/** Score de pertinence d'un produit pour un profil. Plus il est haut, plus le produit remonte. */
export function scoreForProfile(
  product: PersonalizableProduct,
  profile: PersonalizationProfile,
): number {
  let score = 0;

  if (profile.interests.includes(product.category)) {
    score += PERSONALIZATION_POINTS.matchingInterest;
  }

  const { min, max } = budgetBounds(profile.budgetRange);
  if (product.minimumOrderTotalXaf <= max) {
    score += PERSONALIZATION_POINTS.affordable;
    if (product.minimumOrderTotalXaf >= min) score += PERSONALIZATION_POINTS.usesBudget;
  } else {
    score += PERSONALIZATION_POINTS.tooExpensive;
  }

  if (product.marginPercent !== null && product.marginPercent > 0) {
    score += Math.min(PERSONALIZATION_POINTS.maxMarginBonus, Math.round(product.marginPercent / 5));
  }

  if (product.risk !== null) score += RISK_POINTS[product.risk];

  return score;
}

/**
 * Classe une liste par score décroissant.
 * À égalité, l'identifiant tranche : le tri reste stable d'un appel à l'autre, donc paginable.
 */
export function rankForProfile<T extends PersonalizableProduct>(
  products: T[],
  profile: PersonalizationProfile,
): T[] {
  return [...products].sort((left, right) => {
    const difference = scoreForProfile(right, profile) - scoreForProfile(left, profile);
    if (difference !== 0) return difference;
    return left.id.localeCompare(right.id);
  });
}
