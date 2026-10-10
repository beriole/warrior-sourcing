import { z } from 'zod';

/**
 * Business Lab (lot LAB, §27).
 *
 * Un projet commercial suit une importation après la livraison : ce qu'elle a coûté, ce
 * qui a été vendu, ce qu'il reste. C'est l'étape « mesurer » de la boucle, celle qui dit
 * si l'opération a rapporté — et la seule qui permette de ne pas répéter une erreur.
 *
 * Règles de fond (§54) :
 * - tous les montants sont des entiers en FCFA ;
 * - rien n'est projeté : les indicateurs ne portent que sur les ventes réellement
 *   saisies. Aucune extrapolation du type « au rythme actuel, vous gagnerez… » ;
 * - un projet sans vente affiche zéro, pas une estimation ;
 * - la marge est celle constatée sur les unités vendues, pas celle espérée sur le lot.
 */

const xaf = z.number().int();

// ───────────────────────── Projet ─────────────────────────

export const BusinessProjectInputSchema = z
  .object({
    name: z.string().trim().min(3).max(140),
    /** Ce que le lot a coûté en tout, rendu au Cameroun : marchandise, fret, frais. */
    capitalXaf: xaf.positive(),
    /** Nombre d'unités achetées. */
    quantity: z.number().int().positive().max(1_000_000),
    /** Prix de vente visé à l'unité. Sert de repère, jamais de promesse. */
    targetUnitPriceXaf: xaf.positive(),
    /** Référence de la commande d'importation, quand le projet en suit une. */
    orderReference: z.string().trim().max(40).nullable().default(null),
    startedAt: z.iso.datetime(),
    notes: z.string().trim().max(2_000).nullable().default(null),
  })
  .superRefine((value, ctx) => {
    // Un prix de vente sous le coût de revient n'est pas interdit — on peut écouler à
    // perte — mais il doit être choisi en connaissance de cause, pas par étourderie.
    const coutUnitaire = Math.round(value.capitalXaf / value.quantity);
    if (value.targetUnitPriceXaf < coutUnitaire) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetUnitPriceXaf'],
        message: `À ce prix, chaque unité est vendue sous son coût de revient (${coutUnitaire} FCFA).`,
      });
    }
  });
export type BusinessProjectInput = z.infer<typeof BusinessProjectInputSchema>;

/** Une vente saisie au fil de l'eau : c'est la seule source des indicateurs. */
export const BusinessSaleInputSchema = z.object({
  quantity: z.number().int().positive().max(1_000_000),
  /** Prix réellement obtenu à l'unité, qui n'est pas toujours le prix visé. */
  unitPriceXaf: xaf.nonnegative(),
  soldAt: z.iso.datetime(),
  note: z.string().trim().max(300).nullable().default(null),
});
export type BusinessSaleInput = z.infer<typeof BusinessSaleInputSchema>;

export const BusinessSaleSchema = BusinessSaleInputSchema.extend({
  id: z.string(),
  /** Montant encaissé sur cette vente : quantité × prix unitaire. */
  totalXaf: xaf,
});
export type BusinessSale = z.infer<typeof BusinessSaleSchema>;

// ───────────────────────── Indicateurs (LAB-02) ─────────────────────────

/**
 * Ce que les ventes saisies disent du projet. Tout est constaté, rien n'est projeté.
 */
export const BusinessMetricsSchema = z.object({
  /** Unités vendues, toutes ventes confondues. */
  soldQuantity: z.number().int(),
  /** Unités qu'il reste à vendre. Jamais négatif : voir `oversold`. */
  remainingQuantity: z.number().int(),
  /**
   * Vrai quand plus d'unités ont été saisies que le lot n'en comptait. C'est une erreur
   * de saisie ou un lot sous-estimé : on le signale au lieu de l'absorber en silence.
   */
  oversold: z.boolean(),
  /** Chiffre d'affaires encaissé. */
  revenueXaf: xaf,
  /** Coût de revient d'une unité : capital engagé divisé par la quantité achetée. */
  unitCostXaf: xaf,
  /** Coût des unités effectivement vendues. */
  soldCostXaf: xaf,
  /** Marge constatée sur ce qui est vendu : chiffre d'affaires moins coût des unités vendues. */
  marginXaf: xaf,
  /** Prix de vente moyen réellement obtenu, `null` tant que rien n'est vendu. */
  averageUnitPriceXaf: xaf.nullable(),
  /** Retour sur investissement en pourcentage entier, calculé sur le capital engagé. */
  roiPercent: z.number().int(),
  /** Part du capital déjà récupérée par les encaissements, de 0 à 100. */
  capitalRecoveredPercent: z.number().int().min(0).max(100),
  /** Ce qui reste à encaisser pour rembourser le capital. Zéro une fois couvert. */
  capitalRemainingXaf: xaf,
  /**
   * Unités restant à vendre au prix visé pour couvrir le capital. `null` quand le capital
   * est déjà récupéré, ou quand le prix visé ne permettrait jamais de le couvrir.
   */
  unitsToBreakEven: z.number().int().nullable(),
  /** Vrai dès que les encaissements couvrent le capital engagé. */
  capitalRecovered: z.boolean(),
});
export type BusinessMetrics = z.infer<typeof BusinessMetricsSchema>;

/**
 * Calcule les indicateurs d'un projet à partir de ses ventes.
 *
 * Volontairement pur et sans accès à la base : c'est la même fonction côté serveur et
 * côté écran, donc un chiffre affiché ne peut pas diverger d'un chiffre enregistré.
 */
export function computeBusinessMetrics(
  project: { capitalXaf: number; quantity: number; targetUnitPriceXaf: number },
  sales: { quantity: number; unitPriceXaf: number }[],
): BusinessMetrics {
  const soldQuantity = sales.reduce((total, sale) => total + sale.quantity, 0);
  const revenueXaf = sales.reduce((total, sale) => total + sale.quantity * sale.unitPriceXaf, 0);

  const unitCostXaf = Math.round(project.capitalXaf / project.quantity);
  const soldCostXaf = unitCostXaf * soldQuantity;
  const marginXaf = revenueXaf - soldCostXaf;

  const capitalRemainingXaf = Math.max(0, project.capitalXaf - revenueXaf);
  const capitalRecoveredPercent = Math.min(
    100,
    Math.max(0, Math.round((revenueXaf / project.capitalXaf) * 100)),
  );

  // Au prix visé : combien d'unités encore, pour couvrir ce qui manque.
  const unitsToBreakEven =
    capitalRemainingXaf === 0 || project.targetUnitPriceXaf <= 0
      ? null
      : Math.ceil(capitalRemainingXaf / project.targetUnitPriceXaf);

  return {
    soldQuantity,
    remainingQuantity: Math.max(0, project.quantity - soldQuantity),
    oversold: soldQuantity > project.quantity,
    revenueXaf,
    unitCostXaf,
    soldCostXaf,
    marginXaf,
    averageUnitPriceXaf: soldQuantity > 0 ? Math.round(revenueXaf / soldQuantity) : null,
    // Le ROI se mesure sur le capital engagé, pas sur la part déjà vendue : c'est bien
    // tout l'argent immobilisé qui doit être rémunéré.
    roiPercent: Math.round((marginXaf / project.capitalXaf) * 100),
    capitalRecoveredPercent,
    capitalRemainingXaf,
    unitsToBreakEven,
    capitalRecovered: capitalRemainingXaf === 0,
  };
}

/**
 * Phrase d'état d'un projet, écrite une seule fois ici pour que l'écran et un éventuel
 * email disent exactement la même chose. Jamais de prédiction : on décrit ce qui est.
 */
export function describeBusinessProgress(metrics: BusinessMetrics): string {
  if (metrics.oversold) {
    return 'Plus d’unités vendues que le lot n’en comptait : vérifiez la quantité achetée ou vos saisies.';
  }
  if (metrics.soldQuantity === 0) {
    return 'Aucune vente saisie pour l’instant : les indicateurs resteront à zéro jusqu’à la première.';
  }
  if (metrics.remainingQuantity === 0) {
    return metrics.marginXaf >= 0
      ? `Lot entièrement vendu, avec une marge de ${metrics.marginXaf.toLocaleString('fr-FR')} FCFA.`
      : `Lot entièrement vendu, avec une perte de ${Math.abs(metrics.marginXaf).toLocaleString('fr-FR')} FCFA.`;
  }
  if (metrics.capitalRecovered) {
    return `Capital récupéré. Il reste ${metrics.remainingQuantity} unité${metrics.remainingQuantity > 1 ? 's' : ''} à vendre, et tout ce qui rentre est désormais du bénéfice.`;
  }
  if (metrics.unitsToBreakEven !== null) {
    return `Il reste ${metrics.remainingQuantity} unité${metrics.remainingQuantity > 1 ? 's' : ''} à vendre, dont ${metrics.unitsToBreakEven} au prix visé pour rembourser le capital.`;
  }
  return `Il reste ${metrics.remainingQuantity} unité${metrics.remainingQuantity > 1 ? 's' : ''} à vendre.`;
}

// ───────────────────────── Réponses ─────────────────────────

export const BusinessProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  capitalXaf: xaf,
  quantity: z.number().int(),
  targetUnitPriceXaf: xaf,
  orderReference: z.string().nullable(),
  startedAt: z.iso.datetime(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  metrics: BusinessMetricsSchema,
  /** Phrase d'état, écrite par le serveur pour que tous les écrans la disent pareil. */
  progressLabel: z.string(),
  saleCount: z.number().int(),
});
export type BusinessProject = z.infer<typeof BusinessProjectSchema>;

export const BusinessProjectDetailSchema = BusinessProjectSchema.extend({
  sales: z.array(BusinessSaleSchema),
});
export type BusinessProjectDetail = z.infer<typeof BusinessProjectDetailSchema>;

export const BusinessProjectListResponseSchema = z.object({
  items: z.array(BusinessProjectSchema),
  /** Capital engagé sur l'ensemble des projets ouverts. */
  totalCapitalXaf: xaf,
  /** Chiffre d'affaires encaissé, tous projets confondus. */
  totalRevenueXaf: xaf,
  /** Marge constatée, tous projets confondus. Peut être négative. */
  totalMarginXaf: xaf,
});
export type BusinessProjectListResponse = z.infer<typeof BusinessProjectListResponseSchema>;

export const BusinessProjectResponseSchema = z.object({ project: BusinessProjectDetailSchema });
export type BusinessProjectResponse = z.infer<typeof BusinessProjectResponseSchema>;
