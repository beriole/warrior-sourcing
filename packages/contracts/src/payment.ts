import { z } from 'zod';

/** Cahier §23 : moyens de paiement locaux. */
export const PAYMENT_METHODS = ['MTN_MOMO', 'ORANGE_MONEY', 'CARD'] as const;
export const PaymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  MTN_MOMO: 'MTN Mobile Money',
  ORANGE_MONEY: 'Orange Money',
  CARD: 'Carte bancaire',
};

/** Cahier §23 : états de paiement. */
export const PAYMENT_STATUSES = [
  'INITIATED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;
export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  INITIATED: 'Initié',
  PENDING: 'En attente de confirmation',
  SUCCEEDED: 'Réussi',
  FAILED: 'Échoué',
  EXPIRED: 'Expiré',
  REFUNDED: 'Remboursé',
  PARTIALLY_REFUNDED: 'Partiellement remboursé',
};

/**
 * Machine à états stricte : toute transition non listée est refusée côté serveur.
 * Un webhook rejoué qui tente une transition déjà faite doit être ignoré (idempotence).
 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  INITIATED: ['PENDING', 'FAILED', 'EXPIRED'],
  PENDING: ['SUCCEEDED', 'FAILED', 'EXPIRED'],
  SUCCEEDED: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  PARTIALLY_REFUNDED: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  FAILED: [],
  EXPIRED: [],
  REFUNDED: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export function isFinalPaymentStatus(status: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[status].length === 0;
}
