import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getEmail, isEmailKey } from '@ws/emails';
import { AppModule } from '../app.module.js';
import type { Env } from '../config/env.js';
import { MailService } from '../mail/mail.service.js';

/**
 * Envoi d'un email de test en ligne de commande.
 *
 *   pnpm --filter @ws/api email:send welcome
 *   pnpm --filter @ws/api email:send payment-confirmed "Montant important" autre@exemple.cm
 *
 * Sans RESEND_API_KEY, le message est écrit dans apps/api/.mail au lieu d'être expédié.
 */
const [, , key, fixtureName, recipient] = process.argv;
const logger = new Logger('email:send');

if (!key || !isEmailKey(key)) {
  logger.error(`Template inconnu. Clés disponibles : ${Object.keys(await import('@ws/emails').then((m) => m.EMAILS)).join(', ')}`);
  process.exit(1);
}

const definition = getEmail(key);
const fixtures = definition.fixtures;
const chosen = fixtureName ?? Object.keys(fixtures)[0];

if (!chosen || !Object.hasOwn(fixtures, chosen)) {
  logger.error(`Jeu de données inconnu. Disponibles : ${Object.keys(fixtures).join(' | ')}`);
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });

try {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const to = recipient ?? config.get('MAIL_TEST_RECIPIENT', { infer: true });

  const result = await app.get(MailService).send({ to, template: key, data: fixtures[chosen] });

  logger.log(`« ${result.subject} » → ${to} (transport : ${result.transport})`);
  if (result.providerId) logger.log(`Identifiant fournisseur : ${result.providerId}`);
} finally {
  await app.close();
}
