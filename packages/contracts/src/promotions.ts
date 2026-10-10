import { z } from 'zod';

/**
 * Promotions (§43).
 *
 * Un seul moteur pour tout ce qui se vend : formations, abonnements, et plus tard
 * prestations. Une remise écrite deux fois est une remise qui finira par diverger, et
 * c'est sur un montant qu'elle divergerait.
 *
 * Règles de fond (§54), appliquées par le calcul lui-même :
 *
 * - **Le prix barré est un prix réellement pratiqué.** On ne gonfle jamais une référence
 *   pour donner l'illusion d'une remise : la référence est le prix courant de la fiche.
 * - **Une fin de validité annoncée est une vraie fin.** Pas de compte à rebours qui
 *   repart tout seul.
 * - **Un quota affiché est un vrai quota.** On n'écrit « plus que 3 » que si le nombre
 *   d'utilisations restantes est réellement limité et connu.
 * - **Jamais de prix négatif.** Une remise supérieure au prix ramène à zéro, et c'est
 *   annoncé comme « offert », pas comme un avoir.
 */

const xaf = z.number().int();

// ───────────────────────── Nature de la remise ─────────────────────────

/**
 * Les quatre formes de remise réellement courantes. Tout le reste s'exprime avec
 * celles-ci : « 2 mois offerts » est un pourcentage sur un abonnement annuel, « gratuit
 * pour les nouveaux » est un `FREE` conditionné à la première commande.
 */
export const DISCOUNT_KINDS = ['PERCENTAGE', 'AMOUNT', 'FIXED_PRICE', 'FREE'] as const;
export const DiscountKindSchema = z.enum(DISCOUNT_KINDS);
export type DiscountKind = z.infer<typeof DiscountKindSchema>;

export const DISCOUNT_KIND_LABELS: Record<DiscountKind, { label: string; hint: string }> = {
  PERCENTAGE: { label: 'Pourcentage', hint: 'Ex. −30 % sur le prix affiché.' },
  AMOUNT: { label: 'Montant fixe', hint: 'Ex. −5 000 FCFA sur le prix affiché.' },
  FIXED_PRICE: { label: 'Prix promotionnel', hint: 'Ex. 9 900 FCFA au lieu de 25 000.' },
  FREE: { label: 'Offert', hint: 'Le prix tombe à zéro.' },
};

/** Ce sur quoi une promotion peut porter. */
export const PROMOTION_TARGETS = ['COURSE', 'COURSE_THEME', 'ALL_COURSES', 'PLAN', 'ALL_PLANS'] as const;
export const PromotionTargetSchema = z.enum(PROMOTION_TARGETS);
export type PromotionTarget = z.infer<typeof PromotionTargetSchema>;

export const PROMOTION_TARGET_LABELS: Record<PromotionTarget, string> = {
  COURSE: 'Une formation précise',
  COURSE_THEME: 'Toutes les formations d’un thème',
  ALL_COURSES: 'Toutes les formations',
  PLAN: 'Une offre d’abonnement',
  ALL_PLANS: 'Toutes les offres d’abonnement',
};

/** Comment la promotion s'obtient. */
export const PROMOTION_TRIGGERS = ['AUTOMATIC', 'CODE'] as const;
export const PromotionTriggerSchema = z.enum(PROMOTION_TRIGGERS);
export type PromotionTrigger = z.infer<typeof PromotionTriggerSchema>;

export const PROMOTION_TRIGGER_LABELS: Record<PromotionTrigger, { label: string; hint: string }> = {
  AUTOMATIC: { label: 'Automatique', hint: 'Appliquée à tous, sans rien saisir.' },
  CODE: { label: 'Sur code', hint: 'Appliquée seulement si le client saisit le code.' },
};

// ───────────────────────── Définition d'une promotion ─────────────────────────

/** Code promotionnel : lisible à l'oral, sans caractères qu'on confond. */
export const PromotionCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3)
  .max(24)
  .regex(/^[A-Z0-9-]+$/, 'Le code ne contient que des lettres, des chiffres et des tirets.');

export const PromotionInputSchema = z
  .object({
    name: z.string().trim().min(3).max(140),
    /** Phrase montrée au client. Elle doit décrire l'offre, pas la vanter. */
    description: z.string().trim().max(300).nullable().default(null),

    kind: DiscountKindSchema,
    /** Pourcentage entier de 1 à 100, pour `PERCENTAGE`. */
    percentage: z.number().int().min(1).max(100).nullable().default(null),
    /** Montant en FCFA, pour `AMOUNT` (remise) ou `FIXED_PRICE` (nouveau prix). */
    amountXaf: xaf.nonnegative().nullable().default(null),

    target: PromotionTargetSchema,
    /** Identifiant de la formation ou de l'offre visée, selon la portée. */
    targetId: z.string().trim().min(1).max(100).nullable().default(null),

    trigger: PromotionTriggerSchema.default('AUTOMATIC'),
    code: PromotionCodeSchema.nullable().default(null),

    startsAt: z.iso.datetime(),
    /** Fin de validité. `null` pour une promotion sans terme annoncé. */
    endsAt: z.iso.datetime().nullable().default(null),

    /** Nombre total d'utilisations. `null` = illimité, et rien n'est alors affiché. */
    maxRedemptions: z.number().int().positive().max(1_000_000).nullable().default(null),
    /** Utilisations par compte. 1 pour une offre de bienvenue. */
    maxPerCustomer: z.number().int().positive().max(100).default(1),
    /** Réservée à un premier achat. */
    firstPurchaseOnly: z.boolean().default(false),
    /** Montant minimum d'achat pour que la remise s'applique. */
    minimumAmountXaf: xaf.nonnegative().nullable().default(null),

    active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'PERCENTAGE' && value.percentage === null) {
      ctx.addIssue({ code: 'custom', path: ['percentage'], message: 'Indiquez le pourcentage de remise.' });
    }
    if ((value.kind === 'AMOUNT' || value.kind === 'FIXED_PRICE') && value.amountXaf === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['amountXaf'],
        message:
          value.kind === 'AMOUNT' ? 'Indiquez le montant de la remise.' : 'Indiquez le prix promotionnel.',
      });
    }
    if (value.trigger === 'CODE' && !value.code) {
      ctx.addIssue({ code: 'custom', path: ['code'], message: 'Une promotion sur code doit porter un code.' });
    }
    const viseUnObjet = value.target === 'COURSE' || value.target === 'COURSE_THEME' || value.target === 'PLAN';
    if (viseUnObjet && !value.targetId) {
      ctx.addIssue({ code: 'custom', path: ['targetId'], message: 'Indiquez ce que la promotion vise.' });
    }
    if (value.endsAt && value.endsAt <= value.startsAt) {
      // Une fenêtre qui se termine avant de commencer ne s'appliquerait jamais, et
      // l'erreur ne se verrait qu'en constatant qu'aucun client n'en profite.
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'La fin doit suivre le début.' });
    }
  });
export type PromotionInput = z.infer<typeof PromotionInputSchema>;

export const PromotionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  kind: DiscountKindSchema,
  kindLabel: z.string(),
  percentage: z.number().int().nullable(),
  amountXaf: xaf.nullable(),
  target: PromotionTargetSchema,
  targetLabel: z.string(),
  targetId: z.string().nullable(),
  /** Nom lisible de ce qui est visé, quand il a pu être résolu. */
  targetName: z.string().nullable(),
  trigger: PromotionTriggerSchema,
  code: z.string().nullable(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  maxRedemptions: z.number().int().nullable(),
  maxPerCustomer: z.number().int(),
  firstPurchaseOnly: z.boolean(),
  minimumAmountXaf: xaf.nullable(),
  active: z.boolean(),
  /** Nombre d'utilisations déjà enregistrées. */
  redemptionCount: z.number().int(),
  /** Vrai quand la promotion s'applique réellement en ce moment. */
  live: z.boolean(),
  /** Pourquoi elle ne s'applique pas, `null` quand elle s'applique. */
  inactiveReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Promotion = z.infer<typeof PromotionSchema>;

// ───────────────────────── Prix remisé ─────────────────────────

/**
 * Prix tel qu'il est montré au client. Les deux montants sont réels : `originalXaf` est
 * le prix de la fiche, `finalXaf` ce qui sera débité. Afficher un prix barré supérieur au
 * prix de la fiche serait une fausse remise.
 */
export const PricedSchema = z.object({
  originalXaf: xaf,
  finalXaf: xaf,
  /** Ce qui est retiré. Zéro quand aucune promotion ne s'applique. */
  discountXaf: xaf,
  /** Remise en pourcentage entier, pour l'étiquette. Zéro sans promotion. */
  discountPercent: z.number().int(),
  /** Identifiant et nom de la promotion appliquée, `null` s'il n'y en a pas. */
  promotionId: z.string().nullable(),
  promotionName: z.string().nullable(),
  promotionCode: z.string().nullable(),
  /** Fin de l'offre, quand elle en a une. Jamais inventée pour presser le client. */
  promotionEndsAt: z.iso.datetime().nullable(),
  /**
   * Utilisations restantes, seulement si un quota réel existe. `null` sinon : on n'écrit
   * pas « plus que quelques places » quand il n'y a pas de limite.
   */
  remainingRedemptions: z.number().int().nullable(),
  /** Vrai quand le prix final est nul. */
  free: z.boolean(),
});
export type Priced = z.infer<typeof PricedSchema>;

/** Une promotion telle que le calcul en a besoin : rien de plus. */
export type ApplicablePromotion = {
  id: string;
  name: string;
  kind: DiscountKind;
  percentage: number | null;
  amountXaf: number | null;
  code: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  minimumAmountXaf: number | null;
};

/** Prix sans promotion : la forme neutre, pour que l'interface n'ait qu'un seul cas. */
export function priceWithoutPromotion(originalXaf: number): Priced {
  return {
    originalXaf,
    finalXaf: originalXaf,
    discountXaf: 0,
    discountPercent: 0,
    promotionId: null,
    promotionName: null,
    promotionCode: null,
    promotionEndsAt: null,
    remainingRedemptions: null,
    free: originalXaf === 0,
  };
}

/**
 * Applique une remise à un prix.
 *
 * Pure et partagée entre le serveur et l'écran : le prix annoncé sur une fiche et le
 * prix débité au paiement sortent de la même fonction, donc ils ne peuvent pas différer.
 *
 * Les arrondis se font à l'entier inférieur en faveur du client : sur un pourcentage,
 * arrondir la remise vers le haut coûte au plus un franc et ne surprend jamais.
 */
export function applyPromotion(originalXaf: number, promotion: ApplicablePromotion | null): Priced {
  if (!promotion) return priceWithoutPromotion(originalXaf);
  if (promotion.minimumAmountXaf !== null && originalXaf < promotion.minimumAmountXaf) {
    return priceWithoutPromotion(originalXaf);
  }

  const brut = (() => {
    switch (promotion.kind) {
      case 'FREE':
        return 0;
      case 'PERCENTAGE':
        return originalXaf - Math.ceil((originalXaf * (promotion.percentage ?? 0)) / 100);
      case 'AMOUNT':
        return originalXaf - (promotion.amountXaf ?? 0);
      case 'FIXED_PRICE':
        return promotion.amountXaf ?? originalXaf;
    }
  })();

  // Jamais de prix négatif : une remise plus grande que le prix rend l'article offert.
  const finalXaf = Math.max(0, Math.min(brut, originalXaf));
  const discountXaf = originalXaf - finalXaf;

  return {
    originalXaf,
    finalXaf,
    discountXaf,
    discountPercent: originalXaf > 0 ? Math.round((discountXaf / originalXaf) * 100) : 0,
    promotionId: promotion.id,
    promotionName: promotion.name,
    promotionCode: promotion.code,
    promotionEndsAt: promotion.endsAt,
    remainingRedemptions:
      promotion.maxRedemptions === null
        ? null
        : Math.max(0, promotion.maxRedemptions - promotion.redemptionCount),
    free: finalXaf === 0,
  };
}

/**
 * Choisit la promotion la plus avantageuse pour le client parmi celles qui s'appliquent.
 *
 * On ne cumule pas : deux remises empilées produisent des prix que personne ne sait
 * expliquer au téléphone. On prend la meilleure, et on le dit.
 */
export function bestPromotion(
  originalXaf: number,
  promotions: ApplicablePromotion[],
): ApplicablePromotion | null {
  let meilleure: ApplicablePromotion | null = null;
  let meilleurPrix = originalXaf;

  for (const promotion of promotions) {
    const { finalXaf } = applyPromotion(originalXaf, promotion);
    if (finalXaf < meilleurPrix) {
      meilleurPrix = finalXaf;
      meilleure = promotion;
    }
  }

  return meilleure;
}

/**
 * Étiquette de la remise, écrite une seule fois pour que la fiche, le panier et l'email
 * disent la même chose. `null` quand il n'y a rien à annoncer.
 */
export function discountLabel(priced: Priced): string | null {
  if (priced.discountXaf === 0) return null;
  if (priced.free) return 'Offert';
  return `−${priced.discountPercent} %`;
}
