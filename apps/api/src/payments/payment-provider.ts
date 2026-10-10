import type { PaymentStatus } from '@ws/contracts';

/**
 * Interface de l'agrégateur Mobile Money (PAY-01).
 *
 * Le service de paiement ne connaît que cette interface : Fapshi l'implémente en production,
 * une version en mémoire l'implémente dans les tests. Aucun appel réseau ne part des tests.
 *
 * Un seul mode d'encaissement : la demande de paiement est poussée sur le téléphone du
 * payeur (Fapshi `direct-pay`). La page de paiement hébergée a été écartée — elle sort
 * l'utilisateur de l'application, demande une connexion stable le temps de charger une
 * page tierce, et ne dit pas sur quel numéro le débit partira. Pousser la demande sur le
 * téléphone est le geste que les gens connaissent déjà de leur opérateur.
 */

/** Jeton d'injection du fournisseur de paiement. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export type InitiatePaymentInput = {
  /** Montant en FCFA entiers, au moins 100. */
  amountXaf: number;
  /**
   * Numéro national à 9 chiffres à débiter. Obligatoire : tous nos paiements sont
   * poussés sur le téléphone du payeur, jamais renvoyés vers une page hébergée.
   */
  phone: string;
  /** Réseau du numéro, pour orienter la demande. */
  method: 'MTN_MOMO' | 'ORANGE_MONEY';
  /** Notre référence de paiement, renvoyée par l'agrégateur dans `externalId`. */
  reference: string;
  /** Identifiant du compte client. */
  userId: string;
  email?: string;
  name?: string;
  /** Texte court vu par le payeur. */
  message?: string;
};

export type InitiatePaymentResult = {
  /** Identifiant de transaction chez l'agrégateur (`transId`). */
  providerRef: string;
  /**
   * Lien de paiement hébergé. Vaut `null` avec le paiement direct, qui n'en produit pas :
   * le champ reste au contrat parce qu'un agrégateur peut en renvoyer un, et l'interface
   * sait déjà ne rien afficher quand il est absent.
   */
  link: string | null;
  initiatedAt: Date;
};

/** État d'une transaction tel que l'agrégateur le rapporte, déjà traduit dans nos états. */
export type ProviderTransaction = {
  providerRef: string;
  status: PaymentStatus;
  /** État brut de l'agrégateur, gardé pour l'historique. */
  rawStatus: string;
  amountXaf: number | null;
  /** Notre référence, si l'agrégateur l'a renvoyée. */
  externalId: string | null;
  reason: string | null;
  confirmedAt: Date | null;
  raw: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;
  /** Lance un paiement : la demande est poussée sur le téléphone du payeur. */
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  /** Relit l'état d'une transaction : seule source de vérité avant d'écrire SUCCEEDED. */
  status(providerRef: string): Promise<ProviderTransaction>;
  /** Vérifie l'en-tête secret d'un webhook. Faux si aucun secret n'est configuré. */
  verifyWebhookSecret(received: string | undefined): boolean;
  /** Lit l'identifiant de transaction dans le corps d'un webhook. */
  webhookProviderRef(body: unknown): string | null;
}

/** Erreur de communication avec l'agrégateur : jamais exposée telle quelle au client. */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
