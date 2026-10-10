import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessActivation } from './access-activation.service.js';

/**
 * Module minuscule, et c'est le but : il n'importe ni le lot PAY, ni le reste du lot SUB,
 * ni le lot ACA, donc tous peuvent l'importer sans créer de boucle. Nest n'en construit
 * qu'une instance, partagée.
 */
@Module({
  imports: [ConfigModule],
  providers: [AccessActivation],
  exports: [AccessActivation],
})
export class AccessActivationModule {}
