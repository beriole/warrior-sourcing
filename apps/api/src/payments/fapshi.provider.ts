import { Logger } from '@nestjs/common';
import type { PaymentStatus } from '@ws/contracts';
import { timingSafeEqual } from 'node:crypto';
import {
  PaymentProviderError,
  type InitiatePaymentInput,
  type InitiatePaymentResult,
  type PaymentProvider,
  type ProviderTransaction,
} from './payment-provider.js';

/**
 * Adaptateur Fapshi (docs/integrations/fapshi.md).
 *
 * Authentification par les en-têtes `apiuser` et `apikey`. Les montants sont des entiers FCFA.
 * L'URL de base vient de la configuration : elle n'est jamais supposée.
 *
 * Un seul point d'entrée d'encaissement : `POST /direct-pay`, qui pousse la demande sur le
 * téléphone du payeur. `initiate-pay` et sa page hébergée ne sont pas utilisés.
 */

export type FapshiConfig = {
  baseUrl: string;
  apiUser: string;
  apiKey: string;
  webhookSecret?: string;
};

/** Correspondance des états Fapshi vers les nôtres (docs/integrations/fapshi.md). */
const STATUS_MAP: Record<string, PaymentStatus> = {
  CREATED: 'INITIATED',
  PENDING: 'PENDING',
  SUCCESSFUL: 'SUCCEEDED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
};

const MEDIUM: Record<InitiatePaymentInput['method'], string> = {
  MTN_MOMO: 'mobile money',
  ORANGE_MONEY: 'orange money',
};

/** Montant plancher accepté par Fapshi, en FCFA. */
const MONTANT_MINIMUM = 100;

/** Numéro camerounais à neuf chiffres commençant par 6, tel que Fapshi l'attend. */
const NUMERO = /^6\d{8}$/;

type FapshiTransaction = {
  transId?: string;
  status?: string;
  amount?: number;
  externalId?: string;
  reason?: string;
  dateConfirmed?: string;
  [key: string]: unknown;
};

export class FapshiProvider implements PaymentProvider {
  readonly name = 'fapshi';
  private readonly logger = new Logger(FapshiProvider.name);

  constructor(private readonly config: FapshiConfig) {}

  /**
   * Paiement direct : la demande part sur le téléphone du payeur, qui la valide avec son
   * code opérateur. Aucune page intermédiaire, donc rien à charger sur un réseau lent et
   * aucune sortie de l'application.
   *
   * Les deux contrôles ci-dessous doublent ceux du contrat d'entrée. Ils ne sont pas
   * redondants pour rien : ce sont les deux seules raisons pour lesquelles Fapshi refuse
   * une demande autrement valable, et les attraper ici produit un message en français
   * plutôt qu'une erreur d'agrégateur que personne ne peut lire.
   */
  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (!Number.isInteger(input.amountXaf) || input.amountXaf < MONTANT_MINIMUM) {
      throw new PaymentProviderError(
        `Le montant minimum d’un paiement est de ${MONTANT_MINIMUM} FCFA.`,
        { amountXaf: input.amountXaf },
      );
    }
    if (!NUMERO.test(input.phone)) {
      throw new PaymentProviderError(
        'Le numéro à débiter doit être un numéro camerounais à 9 chiffres commençant par 6.',
      );
    }

    const data = await this.call<{ transId?: string; link?: string; dateInitiated?: string; message?: string }>(
      'POST',
      '/direct-pay',
      {
        amount: input.amountXaf,
        phone: input.phone,
        medium: MEDIUM[input.method],
        externalId: input.reference,
        userId: input.userId,
        ...(input.name ? { name: input.name } : {}),
        ...(input.email ? { email: input.email } : {}),
        ...(input.message ? { message: input.message } : {}),
      },
    );

    if (!data.transId) {
      throw new PaymentProviderError('L’agrégateur n’a pas renvoyé d’identifiant de transaction.', data);
    }

    return {
      providerRef: data.transId,
      // `direct-pay` ne renvoie pas de lien : la validation se fait sur le téléphone.
      link: data.link ?? null,
      initiatedAt: data.dateInitiated ? new Date(data.dateInitiated) : new Date(),
    };
  }

  async status(providerRef: string): Promise<ProviderTransaction> {
    const data = await this.call<FapshiTransaction>('GET', `/payment-status/${encodeURIComponent(providerRef)}`);
    return FapshiProvider.toTransaction(data, providerRef);
  }

  verifyWebhookSecret(received: string | undefined): boolean {
    const expected = this.config.webhookSecret;
    if (!expected || !received) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  webhookProviderRef(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null;
    const transId = (body as FapshiTransaction).transId;
    return typeof transId === 'string' && transId.length > 0 ? transId : null;
  }

  /** Traduit l'objet transaction Fapshi. Un état inconnu reste PENDING : on ne conclut pas à sa place. */
  static toTransaction(data: FapshiTransaction, fallbackRef: string): ProviderTransaction {
    const rawStatus = typeof data.status === 'string' ? data.status.toUpperCase() : 'UNKNOWN';
    return {
      providerRef: typeof data.transId === 'string' ? data.transId : fallbackRef,
      status: STATUS_MAP[rawStatus] ?? 'PENDING',
      rawStatus,
      amountXaf: typeof data.amount === 'number' ? Math.round(data.amount) : null,
      externalId: typeof data.externalId === 'string' ? data.externalId : null,
      reason: typeof data.reason === 'string' && data.reason ? data.reason : null,
      confirmedAt: typeof data.dateConfirmed === 'string' && data.dateConfirmed ? new Date(data.dateConfirmed) : null,
      raw: data,
    };
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          apiuser: this.config.apiUser,
          apikey: this.config.apiKey,
        },
        ...(method === 'POST' && body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      this.logger.error(`Fapshi injoignable (${method} ${path}) : ${describeError(error)}`);
      throw new PaymentProviderError('Le service de paiement est injoignable.', error);
    }

    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      this.logger.warn(`Fapshi ${method} ${path} → ${response.status} : ${text.slice(0, 300)}`);
      throw new PaymentProviderError('Le service de paiement a refusé la demande.', {
        status: response.status,
        data,
      });
    }

    return data as T;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
