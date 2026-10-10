import {
  PaymentProviderError,
  type InitiatePaymentInput,
  type InitiatePaymentResult,
  type PaymentProvider,
  type ProviderTransaction,
} from './payment-provider.js';
import { FapshiProvider } from './fapshi.provider.js';

/**
 * Agrégateur en mémoire pour les tests et le développement sans réseau.
 *
 * Il imite le vocabulaire de Fapshi (états CREATED, PENDING, SUCCESSFUL, FAILED, EXPIRED)
 * pour que le service de paiement soit exercé exactement comme en production :
 * seul le transport change. Les tests font avancer une transaction avec `setStatus`.
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';
  readonly webhookSecret = 'secret-de-test';

  private counter = 0;
  private readonly transactions = new Map<string, Record<string, unknown>>();
  /** Force l'échec de la prochaine initiation, pour tester le message rendu au client. */
  failNextInitiation = false;

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (this.failNextInitiation) {
      this.failNextInitiation = false;
      throw new PaymentProviderError('Agrégateur de test : initiation refusée.');
    }
    this.counter += 1;
    const transId = `FAKE${String(this.counter).padStart(6, '0')}`;
    const initiatedAt = new Date();
    this.transactions.set(transId, {
      transId,
      status: 'CREATED',
      amount: input.amountXaf,
      externalId: input.reference,
      userId: input.userId,
      medium: input.method,
      dateInitiated: initiatedAt.toISOString(),
    });
    // Comme `direct-pay` : la demande part sur le téléphone, il n'y a pas de lien.
    return { providerRef: transId, link: null, initiatedAt };
  }

  async status(providerRef: string): Promise<ProviderTransaction> {
    const data = this.transactions.get(providerRef);
    if (!data) throw new PaymentProviderError('Transaction inconnue de l’agrégateur de test.');
    return FapshiProvider.toTransaction(data, providerRef);
  }

  verifyWebhookSecret(received: string | undefined): boolean {
    return received === this.webhookSecret;
  }

  webhookProviderRef(body: unknown): string | null {
    const transId = body && typeof body === 'object' ? (body as { transId?: unknown }).transId : null;
    return typeof transId === 'string' && transId ? transId : null;
  }

  /** Fait évoluer une transaction, comme le ferait le réseau Mobile Money. */
  setStatus(
    providerRef: string,
    status: 'CREATED' | 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'EXPIRED',
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const current = this.transactions.get(providerRef);
    if (!current) throw new Error(`Transaction de test inconnue : ${providerRef}`);
    const next = {
      ...current,
      status,
      ...(status === 'SUCCESSFUL' ? { dateConfirmed: new Date().toISOString() } : {}),
      ...extra,
    };
    this.transactions.set(providerRef, next);
    return next;
  }

  /** Corps de webhook tel que l'agrégateur l'enverrait pour cette transaction. */
  webhookBody(providerRef: string): Record<string, unknown> {
    const current = this.transactions.get(providerRef);
    if (!current) throw new Error(`Transaction de test inconnue : ${providerRef}`);
    return { ...current };
  }

  reset(): void {
    this.transactions.clear();
    this.counter = 0;
    this.failNextInitiation = false;
  }
}
