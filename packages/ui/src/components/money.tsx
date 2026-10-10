import { formatMoney, type Money as MoneyValue } from '@ws/contracts';
import { cn } from '../lib/utils';

/** Affichage d'un montant : chiffres tabulaires, jamais coupés sur deux lignes. */
function Money({ value, className }: { value: MoneyValue; className?: string }) {
  return <span className={cn('figures whitespace-nowrap', className)}>{formatMoney(value)}</span>;
}

export { Money };
