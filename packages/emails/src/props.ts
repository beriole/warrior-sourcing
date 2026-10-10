import { CurrencySchema, SupplierVerificationLevelSchema } from '@ws/contracts';
import { z } from 'zod';

/**
 * Schémas des données d'email.
 *
 * Principe : aucun email ne doit casser parce qu'une donnée manque. Chaque champ optionnel
 * porte une valeur par défaut, et `.catch()` remplace une valeur invalide au lieu de lever.
 */

export const BrandSchema = z
  .object({
    appUrl: z.string().default('https://warrior-sourcing.cm'),
    preferencesUrl: z.string().default('https://warrior-sourcing.cm/profil/notifications'),
    supportEmail: z.string().default('support@warrior-sourcing.cm'),
  })
  .prefault({});
export type Brand = z.infer<typeof BrandSchema>;

/** Prénom : vide accepté (on dit alors « Bonjour, »), très long tronqué proprement. */
export const FirstNameSchema = z
  .string()
  .trim()
  .transform((value) => (value.length > 28 ? `${value.slice(0, 27).trimEnd()}…` : value))
  .catch('')
  .default('');

export const MoneyPropSchema = z
  .object({
    amountMinor: z.number().int().catch(0),
    currency: CurrencySchema.default('XAF'),
  })
  .prefault({ amountMinor: 0 });

export const LinkSchema = z.string().default('https://warrior-sourcing.cm');

/** Salutation tolérante au prénom manquant. */
export function greeting(firstName: string): string {
  return firstName ? `Bonjour ${firstName},` : 'Bonjour,';
}

/** Date lisible en français, avec repli si la valeur est absente ou invalide. */
export function formatDate(value: Date | string | undefined, withTime = false): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'Africa/Douala',
  }).format(date);
}

export const DateSchema = z.union([z.date(), z.string()]).optional();

export const SupplierProposalSchema = z.object({
  name: z.string().default('Fournisseur'),
  city: z.string().default('Chine'),
  level: SupplierVerificationLevelSchema.catch('IDENTITY_VERIFIED').default('IDENTITY_VERIFIED'),
  moq: z.string().default('—'),
  price: z.string().default('—'),
  leadTime: z.string().default('—'),
  href: LinkSchema,
});

/** Base commune : destinataire et contexte de marque. */
export const BaseSchema = z.object({
  firstName: FirstNameSchema,
  brand: BrandSchema,
});
