import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AssistantRequestSchema,
  AssistantResponseSchema,
  AssistantStatusResponseSchema,
  type AssistantRequest,
  type AssistantResponse,
  type AssistantStatusResponse,
} from '@ws/contracts';
import type { Request } from 'express';
import { OptionalSession } from '../auth/optional-session.js';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AssistantService } from './assistant.service.js';

/**
 * Assistant contextuel (AI-01, §30).
 *
 * Ouvert sans compte : quelqu'un qui découvre la plateforme a justement le plus de
 * questions. Une session, quand elle existe, sert seulement à mentionner l'abonnement en
 * cours — elle n'ouvre aucun accès supplémentaire par ce canal.
 */
@ApiTags('Assistant')
@Controller('assistant')
export class AiController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly session: OptionalSession,
  ) {}

  /** L'écran interroge cet état avant de proposer l'assistant : sans clé, il ne l'affiche pas. */
  @Get('etat')
  @ApiOperation({ summary: 'L’assistant est-il configuré, et avec quel modèle' })
  @ApiOkResponse({ schema: toOpenApiSchema(AssistantStatusResponseSchema) })
  etat(): AssistantStatusResponse {
    return this.assistant.status();
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Poser une question à l’assistant',
    description:
      'Le modèle ne lit pas la base : le serveur lui transmet des faits relevés, et lui interdit de citer un chiffre absent de ce bloc.',
  })
  @ApiBody({ schema: toOpenApiSchema(AssistantRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(AssistantResponseSchema) })
  async poser(
    @Body(new ZodValidationPipe(AssistantRequestSchema)) body: AssistantRequest,
    @Req() request: Request,
  ): Promise<AssistantResponse> {
    return this.assistant.repondre(body, await this.session.userId(request));
  }
}
