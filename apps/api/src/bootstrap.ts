import type { INestApplication } from '@nestjs/common';
import { ErrorFilter } from './common/error.filter.js';

/**
 * Réglages communs au serveur réel et aux tests de bout en bout.
 * Les avoir au même endroit évite que les tests passent sur une application
 * configurée autrement que celle servie aux utilisateurs.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('v1');
  app.useGlobalFilters(new ErrorFilter());
  return app;
}
