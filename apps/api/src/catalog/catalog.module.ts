import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { OptionalSession } from '../auth/optional-session.js';

/**
 * Produits et opportunités (lot CAT).
 * Déclarer ici les contrôleurs et services du lot : le module racine est déjà branché.
 */
@Module({
  controllers: [CatalogController],
  providers: [CatalogService, OptionalSession],
  exports: [CatalogService],
})
export class CatalogModule {}
