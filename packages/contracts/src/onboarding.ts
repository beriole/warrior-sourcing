import { z } from 'zod';

/** Cahier §10 : profil d'importateur, peu de questions à forte valeur. */
export const IMPORTER_LEVELS = [
  'BEGINNER',
  'FEW_ORDERS',
  'REGULAR',
  'TRADER',
  'COMPANY',
] as const;
export const ImporterLevelSchema = z.enum(IMPORTER_LEVELS);
export type ImporterLevel = z.infer<typeof ImporterLevelSchema>;

export const IMPORTER_LEVEL_LABELS: Record<ImporterLevel, string> = {
  BEGINNER: 'Débutant',
  FEW_ORDERS: '1 à 3 commandes',
  REGULAR: 'Importateur régulier',
  TRADER: 'Commerçant',
  COMPANY: 'Entreprise',
};

export const IMPORTER_GOALS = [
  'LEARN',
  'FIND_PRODUCTS',
  'FIND_SUPPLIERS',
  'ORDER',
  'REDUCE_COSTS',
  'GROW_BUSINESS',
] as const;
export const ImporterGoalSchema = z.enum(IMPORTER_GOALS);
export type ImporterGoal = z.infer<typeof ImporterGoalSchema>;

export const IMPORTER_GOAL_LABELS: Record<ImporterGoal, string> = {
  LEARN: 'Apprendre',
  FIND_PRODUCTS: 'Trouver des produits',
  FIND_SUPPLIERS: 'Trouver des fournisseurs',
  ORDER: 'Commander',
  REDUCE_COSTS: 'Réduire mes coûts',
  GROW_BUSINESS: 'Développer mon commerce',
};

/** Tranches de budget en FCFA. `max` null = sans plafond. */
export const BUDGET_RANGES = [
  { id: 'UNDER_100K', min: 0, max: 100_000 },
  { id: 'FROM_100K_TO_300K', min: 100_000, max: 300_000 },
  { id: 'FROM_300K_TO_1M', min: 300_000, max: 1_000_000 },
  { id: 'FROM_1M_TO_5M', min: 1_000_000, max: 5_000_000 },
  { id: 'OVER_5M', min: 5_000_000, max: null },
] as const;
export type BudgetRangeId = (typeof BUDGET_RANGES)[number]['id'];
export const BudgetRangeIdSchema = z.enum(
  BUDGET_RANGES.map((range) => range.id) as [BudgetRangeId, ...BudgetRangeId[]],
);

export const INTEREST_CATEGORIES = [
  'PHONES',
  'ACCESSORIES',
  'FASHION',
  'BEAUTY',
  'HOME',
  'ELECTRONICS',
  'AUTO_MOTO',
  'MACHINES',
  'PACKAGING',
  'OTHER',
] as const;
export const InterestCategorySchema = z.enum(INTEREST_CATEGORIES);
export type InterestCategory = z.infer<typeof InterestCategorySchema>;

export const INTEREST_CATEGORY_LABELS: Record<InterestCategory, string> = {
  PHONES: 'Téléphones',
  ACCESSORIES: 'Accessoires',
  FASHION: 'Mode',
  BEAUTY: 'Beauté',
  HOME: 'Maison',
  ELECTRONICS: 'Électronique',
  AUTO_MOTO: 'Auto / moto',
  MACHINES: 'Machines',
  PACKAGING: 'Packaging',
  OTHER: 'Autres',
};

/**
 * Nom affiché du compte.
 *
 * La connexion se fait par email avec un code : rien n'y demande comment la personne
 * s'appelle, et un compte frais a donc un nom vide. C'est l'onboarding qui le recueille,
 * parce que c'est le premier moment où on a quelque chose à demander — et parce que sans
 * lui, l'email de bienvenue, le tableau de bord et les échanges avec l'équipe s'adressent
 * à personne.
 */
export const DisplayNameSchema = z
  .string()
  .trim()
  .min(2, 'Indiquez au moins deux caractères.')
  .max(80, 'Ce nom est trop long.');

export const ImporterProfileSchema = z.object({
  /** Nom ou prénom tel que la personne veut être appelée. */
  name: DisplayNameSchema,
  level: ImporterLevelSchema,
  goals: z.array(ImporterGoalSchema).min(1),
  budgetRange: BudgetRangeIdSchema,
  interests: z.array(InterestCategorySchema).min(1),
  city: z.string().min(2).max(80).optional(),
});
export type ImporterProfile = z.infer<typeof ImporterProfileSchema>;
