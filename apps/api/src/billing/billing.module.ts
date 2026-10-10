import { Module } from '@nestjs/common';
import { OptionalSession } from '../auth/optional-session.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { BillingController } from './billing.controller.js';
import { PromotionsService } from './promotions.service.js';
import { AccessActivationModule } from './access-activation.module.js';
import { SubscriptionsService } from './subscriptions.service.js';

/**
 * Prix, promotions et abonnements (§43).
 *
 * `PromotionsService` est exporté : les autres lots en ont besoin pour afficher un prix
 * remisé, et il ne doit exister qu'un seul endroit où une remise se calcule.
 */
@Module({
  imports: [PaymentsModule, AccessActivationModule],
  controllers: [BillingController],
  providers: [SubscriptionsService, PromotionsService, OptionalSession],
  exports: [SubscriptionsService, PromotionsService],
})
export class BillingModule {}
