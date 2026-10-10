import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../dist/app.module.js';

/**
 * Écrit le contrat OpenAPI sur disque, sans démarrer de serveur.
 * C'est ce fichier qui sert à générer le client typé du front : la génération ne dépend
 * donc pas d'une API qui tourne, et le contrat est versionné avec le code.
 */
const app = await NestFactory.create(AppModule, { logger: false });
app.setGlobalPrefix('v1');
await app.init();

const document = SwaggerModule.createDocument(
  app,
  new DocumentBuilder()
    .setTitle('Warrior Sourcing API')
    .setDescription('API de la plateforme d’importation Chine → Cameroun')
    .setVersion('0.1.0')
    .build(),
);

const target = fileURLToPath(new URL('../openapi.json', import.meta.url));
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
await app.close();

console.log(`Contrat écrit : ${target} (${Object.keys(document.paths).length} chemins)`);
process.exit(0);
