import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AUTH_BASE_PATH, type Auth } from './auth/auth.config.js';
import { AUTH } from './auth/auth.tokens.js';
import { configureApp } from './bootstrap.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  // Better Auth lit le corps brut des requêtes : on branche son gestionnaire
  // avant d'activer l'analyse JSON d'Express.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.use((helmet as unknown as () => any)());
  app.enableCors({
    origin: [config.get('WEB_ORIGIN', { infer: true }), config.get('ADMIN_ORIGIN', { infer: true })],
    credentials: true,
  });

  app.use(AUTH_BASE_PATH, toNodeHandler(app.get<Auth>(AUTH)));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  configureApp(app);
  app.enableShutdownHooks();

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Warrior Sourcing API')
        .setDescription('API de la plateforme d’importation Chine → Cameroun')
        .setVersion('0.1.0')
        .build(),
    );
    // Contrat OpenAPI : source de génération du client typé du front (Orval).
    SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'openapi.json' });
  }

  await app.listen(config.get('PORT', { infer: true }));
}

await bootstrap();
