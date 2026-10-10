import { z } from 'zod';

/**
 * Tous les montants sont stockés en unités mineures entières (jamais en flottants).
 * Le FCFA n'a pas de subdivision : 1 XAF = 1 unité mineure.
 */
export const CURRENCIES = ['XAF', 'CNY', 'USD', 'EUR'] as const;
export const CurrencySchema = z.enum(CURRENCIES);
export type Currency = z.infer<typeof CurrencySchema>;

export const MINOR_UNIT_DIGITS: Record<Currency, number> = {
  XAF: 0,
  CNY: 2,
  USD: 2,
  EUR: 2,
};

export const MoneySchema = z.object({
  amountMinor: z.number().int(),
  currency: CurrencySchema,
});
export type Money = z.infer<typeof MoneySchema>;

/**
 * Taux de conversion daté (cahier §20 : « conversion de devise datée »).
 * `rate` = combien d'unités de `quote` pour 1 unité de `base`, en unités majeures.
 */
export const ExchangeRateSchema = z.object({
  base: CurrencySchema,
  quote: CurrencySchema,
  rate: z.number().positive(),
  observedAt: z.coerce.date(),
  source: z.string().min(1),
});
export type ExchangeRate = z.infer<typeof ExchangeRateSchema>;

export function toMajor(money: Money): number {
  return money.amountMinor / 10 ** MINOR_UNIT_DIGITS[money.currency];
}

export function fromMajor(amount: number, currency: Currency): Money {
  return { amountMinor: Math.round(amount * 10 ** MINOR_UNIT_DIGITS[currency]), currency };
}

export function convert(money: Money, rate: ExchangeRate): Money {
  if (money.currency === rate.quote) return money;
  if (money.currency !== rate.base) {
    throw new Error(`Taux ${rate.base}/${rate.quote} inapplicable à ${money.currency}`);
  }
  return fromMajor(toMajor(money) * rate.rate, rate.quote);
}

export function formatMoney(money: Money, locale = 'fr-CM'): string {
  const digits = MINOR_UNIT_DIGITS[money.currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toMajor(money));
}
