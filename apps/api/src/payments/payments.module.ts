import { Logger, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessActivationModule } from '../billing/access-activation.module.js';
import type { Env } from '../config/env.js';
import { FakePaymentProvider } from './fake.provider.js';
import { FapshiProvider } from './fapshi.provider.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

/**
 * Choisit l'agrégateur d'après la configuration.
 * En test, ou sans clés, l'implémentation en mémoire prend le relais : aucun appel réseau.
 */
function buildProvider(config: ConfigService<Env, true>): PaymentProvider {
  const logger = new Logger('Paiements');
  const get = <K extends keyof Env>(key: K) => config.get(key, { infer: true });

  if (get('NODE_ENV') === 'test') {
    logger.log('Agrégateur de test en mémoire (NODE_ENV=test).');
    return new FakePaymentProvider();
  }

  const sandbox = get('FAPSHI_ENV') !== 'live';
  const baseUrl = sandbox ? (get('FAPSHI_BASE_URL_SANDBOX') ?? get('FAPSHI_BASE_URL')) : get('FAPSHI_BASE_URL');
  const apiUser = sandbox ? (get('FAPSHI_API_USER_SANDBOX') ?? get('FAPSHI_API_USER')) : get('FAPSHI_API_USER');
  const apiKey = sandbox ? (get('FAPSHI_API_KEY_SANDBOX') ?? get('FAPSHI_API_KEY')) : get('FAPSHI_API_KEY');

  if (!baseUrl || !apiUser || !apiKey) {
    logger.warn('Clés Fapshi absentes : agrégateur de test en mémoire. Aucun paiement réel ne sera lancé.');
    return new FakePaymentProvider();
  }

  logger.log(`Agrégateur Fapshi (${sandbox ? 'bac à sable' : 'production'}) : ${baseUrl}`);
  return new FapshiProvider({ baseUrl, apiUser, apiKey, webhookSecret: get('FAPSHI_WEBHOOK_SECRET') });
}

/**
 * Paiements Fapshi (lot PAY).
 *
 * La réconciliation périodique est un simple setInterval, activé par
 * PAYMENTS_RECONCILE_INTERVAL_MS (en millisecondes ; 0 ou absente : désactivée).
 * Jamais active dans les tests.
 *
 * Elle est lue par `ConfigService`, pas dans `process.env` : la validation d'environnement
 * ne réinjecte dans le processus que les clés qu'elle connaît, si bien qu'une variable
 * absente du schéma est toujours lue comme absente — le réglage était donc sans effet,
 * quoi qu'on écrive dans `.env`.
 */
@Module({
  imports: [AccessActivationModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: PAYMENT_PROVIDER, inject: [ConfigService], useFactory: buildProvider },
  ],
  exports: [PaymentsService, PAYMENT_PROVIDER],
})
export class PaymentsModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Paiements');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    const interval = this.config.get('PAYMENTS_RECONCILE_INTERVAL_MS', { infer: true });
    if (this.config.get('NODE_ENV', { infer: true }) === 'test' || interval <= 0) return;

    // Un intervalle trop court épuiserait la limite de débit de l'agrégateur.
    const every = Math.max(interval, 30_000);
    this.logger.log(`Réconciliation des paiements toutes les ${Math.round(every / 1000)} s.`);
    this.timer = setInterval(() => {
      this.payments
        .reconcilePending()
        .then((result) => {
          if (result.checked > 0) {
            this.logger.log(`Réconciliation : ${result.checked} vérifié(s), ${result.updated} mis à jour.`);
          }
        })
        .catch((error: unknown) => {
          this.logger.error(`Réconciliation en échec : ${error instanceof Error ? error.message : String(error)}`);
        });
    }, every);
    // Ne retient pas le processus à l'arrêt.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
