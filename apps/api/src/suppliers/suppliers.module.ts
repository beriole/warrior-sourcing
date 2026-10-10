import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

/**
 * Fournisseurs et sourcing (lot SUP).
 * Déclarer ici les contrôleurs et services du lot : le module racine est déjà branché.
 */
@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
