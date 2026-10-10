/**
 * Saisie d'un numéro camerounais.
 * L'utilisateur tape « 6 70 11 22 33 » comme sur son téléphone ; on envoie du E.164 à l'API.
 */
export const CAMEROON_PREFIX = '+237';

export function digitsOnly(value: string): string {
  return value.replaceAll(/\D/g, '');
}

/** Découpe en groupes lisibles : 6 70 11 22 33. */
export function formatLocalPhone(value: string): string {
  const digits = digitsOnly(value).slice(0, 9);
  const groups = [digits.slice(0, 1), digits.slice(1, 3), digits.slice(3, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return groups.filter(Boolean).join(' ');
}

export function toE164(value: string): string {
  return `${CAMEROON_PREFIX}${digitsOnly(value).slice(0, 9)}`;
}

/** Un mobile camerounais a 9 chiffres et commence par 6. */
export function isValidLocalPhone(value: string): boolean {
  const digits = digitsOnly(value);
  return digits.length === 9 && digits.startsWith('6');
}
