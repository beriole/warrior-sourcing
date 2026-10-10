import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminDisputesService } from './admin-disputes.service.js';
import { AdminAcademyService } from './admin-academy.service.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AdminPaymentsService } from './admin-payments.service.js';
import { AdminProductsService } from './admin-products.service.js';
import { AdminSuppliersService } from './admin-suppliers.service.js';
import { AdminStatsService } from './admin-stats.service.js';
import { AdminUsersService } from './admin-users.service.js';
import { AuditService } from './audit.service.js';

/**
 * Indicateurs et pilotage du back-office (lot ADM).
 * `AuditService` est exporté : les autres lots pourront journaliser leurs actions sensibles
 * sans dupliquer l'écriture dans `AuditLog`.
 */
@Module({
  controllers: [AdminController],
  providers: [
    AdminStatsService,
    AuditService,
    AdminUsersService,
    AdminOrdersService,
    AdminDisputesService,
    AdminProductsService,
    AdminSuppliersService,
    AdminAcademyService,
    AdminPaymentsService,
  ],
  exports: [AuditService],
})
export class AdminModule {}
