import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OptionalSession } from '../auth/optional-session.js';
import { AiController } from './ai.controller.js';
import { AssistantService } from './assistant.service.js';
import { OpenRouterGateway } from './openrouter.gateway.js';

/**
 * Fonctions IA (lot AI, DEC-08).
 *
 * `OpenRouterGateway` est exporté : les autres lots qui auront besoin d'un modèle
 * passeront par lui, et hériteront des mêmes garde-fous. C'est tout l'intérêt d'avoir une
 * passerelle plutôt qu'un appel `fetch` dispersé dans chaque service.
 */
@Module({
  imports: [ConfigModule],
  controllers: [AiController],
  providers: [AssistantService, OpenRouterGateway, OptionalSession],
  exports: [OpenRouterGateway],
})
export class AiModule {}
