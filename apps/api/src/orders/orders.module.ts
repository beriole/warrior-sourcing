import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PreordersController } from './preorders.controller.js';
import { PreordersService } from './preorders.service.js';

/**
 * Commandes et précommandes (lot ORD).
 * Le paiement est délégué au module PAY : une commande ne connaît l'agrégateur qu'à travers lui.
 */
@Module({
  imports: [PaymentsModule],
  controllers: [OrdersController, PreordersController],
  providers: [OrdersService, PreordersService],
  exports: [OrdersService, PreordersService],
})
export class OrdersModule {}
