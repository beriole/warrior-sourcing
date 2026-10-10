import { z } from 'zod';

/**
 * Cahier §16 : jamais de badge « vérifié » vague.
 * Chaque niveau dit précisément ce qui a été contrôlé. Ordre croissant de confiance.
 */
export const SUPPLIER_VERIFICATION_LEVELS = [
  'IDENTITY_VERIFIED',
  'SUPPLIER_TESTED',
  'QUALITY_TESTED',
  'PARTNER',
] as const;
export const SupplierVerificationLevelSchema = z.enum(SUPPLIER_VERIFICATION_LEVELS);
export type SupplierVerificationLevel = z.infer<typeof SupplierVerificationLevelSchema>;

export const SUPPLIER_VERIFICATION_LABELS: Record<
  SupplierVerificationLevel,
  { label: string; meaning: string }
> = {
  IDENTITY_VERIFIED: {
    label: 'Identité vérifiée',
    meaning: 'Les informations d’entreprise ont été contrôlées.',
  },
  SUPPLIER_TESTED: {
    label: 'Fournisseur testé',
    meaning: 'Une commande réelle a été passée chez ce fournisseur.',
  },
  QUALITY_TESTED: {
    label: 'Qualité testée',
    meaning: 'Un produit de ce fournisseur a été inspecté ou reçu.',
  },
  PARTNER: {
    label: 'Partenaire',
    meaning: 'Relation commerciale récurrente avec notre équipe.',
  },
};

export const SUPPLIER_TYPES = ['MANUFACTURER', 'DISTRIBUTOR', 'TRADING_COMPANY'] as const;
export const SupplierTypeSchema = z.enum(SUPPLIER_TYPES);
export type SupplierType = z.infer<typeof SupplierTypeSchema>;

/** Ce que le fournisseur est réellement : fabriquer, revendre ou intermédier. */
export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  MANUFACTURER: 'Usine',
  DISTRIBUTOR: 'Distributeur',
  TRADING_COMPANY: 'Société de négoce',
};
