import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';

/**
 * Prestations et commandes de prestation (lot SRV, §29).
 *
 * `PaymentsModule` est importé plutôt que réécrit : une prestation se règle par le même
 * chemin qu'une commande de marchandise — même agrégateur, même webhook, même
 * réconciliation. Un deuxième parcours de paiement aurait été un deuxième endroit où se
 * tromper sur un montant.
 */
@Module({
  imports: [PaymentsModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
