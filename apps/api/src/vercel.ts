import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AUTH_BASE_PATH, type Auth } from './auth/auth.config.js';
import { AUTH } from './auth/auth.tokens.js';
import { configureApp } from './bootstrap.js';
import type { Env } from './config/env.js';

/**
 * Point d'entrée sans serveur (Vercel).
 *
 * Compilé par `nest build` comme le reste du code : `api/index.js` ne fait que le
 * réexporter. C'est délibéré — l'outil de Vercel aurait à transformer lui-même les
 * décorateurs de NestJS et à produire leurs métadonnées, ce qu'il ne fait pas de la même
 * façon que `tsc`. En lui donnant du JavaScript déjà compilé, il n'a plus qu'à l'empaqueter.
 *
 * `src/main.ts` reste le point d'entrée d'un hébergement classique, où le processus vit.
 * Ici, il n'y a pas de processus qui vit : Vercel appelle une fonction, elle répond, elle
 * peut disparaître. Deux conséquences qui changent le code, pas seulement l'emballage.
 *
 * **1. L'application est construite une seule fois et retenue.** Monter NestJS coûte
 * plusieurs secondes — modules, Prisma, Better Auth. Le faire à chaque requête rendrait le
 * site inutilisable. La promesse est mémorisée au niveau du module : tant que l'instance
 * reste chaude, les requêtes suivantes la réutilisent. Une instance froide la reconstruit,
 * et c'est le prix du sans-serveur.
 *
 * **2. La réconciliation périodique ne tourne pas ici.** Un `setInterval` posé dans une
 * fonction qui s'arrête entre deux requêtes ne se déclenche jamais. Sans elle, un paiement
 * validé sur le téléphone resterait « en attente » jusqu'à ce que quelqu'un consulte la
 * page. C'est pourquoi `vercel.json` déclare un **cron** qui appelle la réconciliation
 * toutes les minutes : le déclencheur vient de l'extérieur, puisqu'il ne peut plus venir
 * de l'intérieur.
 */
let promesse: Promise<Express> | null = null;

async function construire(): Promise<Express> {
  // Better Auth lit le corps brut : son gestionnaire est monté avant l'analyse JSON.
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: ['error', 'warn'] });
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: [config.get('WEB_ORIGIN', { infer: true }), config.get('ADMIN_ORIGIN', { infer: true })],
    credentials: true,
  });

  app.use(AUTH_BASE_PATH, toNodeHandler(app.get<Auth>(AUTH)));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  configureApp(app);
  await app.init();

  return app.getHttpAdapter().getInstance() as Express;
}

/**
 * Vercel appelle ce gestionnaire. On ne l'enveloppe pas dans un try/catch : une erreur de
 * construction doit faire échouer la requête bruyamment, et non répondre un 200 trompeur.
 * La promesse est remise à zéro en cas d'échec, pour qu'une instance ne reste pas coincée
 * sur une construction ratée jusqu'à son recyclage.
 */
export default async function handler(request: unknown, response: unknown): Promise<void> {
  promesse ??= construire().catch((erreur: unknown) => {
    promesse = null;
    throw erreur;
  });

  const serveur = await promesse;
  (serveur as unknown as (req: unknown, res: unknown) => void)(request, response);
}
