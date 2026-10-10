import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ConversationListResponseSchema,
  ConversationQuerySchema,
  ConversationResponseSchema,
  CreateConversationRequestSchema,
  PostMessageRequestSchema,
  type ConversationListResponse,
  type ConversationQuery,
  type ConversationResponse,
  type CreateConversationRequest,
  type PostMessageRequest,
} from '@ws/contracts';
import { AuthGuard, StaffOnly, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { MessagingService } from './messaging.service.js';

/**
 * Messagerie (lot MSG, §32).
 *
 * Tout exige une session : un échange écrit appartient à quelqu'un. L'équipe voit tous
 * les dossiers ; un client ne voit jamais que les siens, quel que soit le paramètre
 * envoyé — la restriction est appliquée par le service, pas par l'interface.
 */
@ApiTags('Messagerie')
@Controller('conversations')
@UseGuards(AuthGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  @ApiOperation({ summary: 'Mes conversations, ou toutes pour l’équipe' })
  @ApiOkResponse({ schema: toOpenApiSchema(ConversationListResponseSchema) })
  list(
    @Req() request: AuthenticatedRequest,
    @Query(new ZodValidationPipe(ConversationQuerySchema)) query: ConversationQuery,
  ): Promise<ConversationListResponse> {
    return this.messaging.list(request.user, query);
  }

  @Get('non-lus')
  @ApiOperation({ summary: 'Nombre de messages non lus, pour la pastille de navigation' })
  unread(@Req() request: AuthenticatedRequest): Promise<{ unread: number }> {
    return this.messaging.unreadCount(request.user);
  }

  @Post()
  @ApiOperation({ summary: 'Ouvrir une conversation avec son premier message' })
  @ApiBody({ schema: toOpenApiSchema(CreateConversationRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(ConversationResponseSchema) })
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateConversationRequestSchema)) input: CreateConversationRequest,
  ): Promise<ConversationResponse> {
    return this.messaging.create(request.user, input);
  }

  /** Ouvrir une conversation vaut lecture : la marque est posée par cette route. */
  @Get(':id')
  @ApiOperation({ summary: 'Une conversation et ses messages' })
  @ApiOkResponse({ schema: toOpenApiSchema(ConversationResponseSchema) })
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<ConversationResponse> {
    return this.messaging.findOne(id, request.user);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Répondre dans une conversation' })
  @ApiBody({ schema: toOpenApiSchema(PostMessageRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(ConversationResponseSchema) })
  postMessage(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(PostMessageRequestSchema)) input: PostMessageRequest,
  ): Promise<ConversationResponse> {
    return this.messaging.postMessage(id, request.user, input);
  }

  @Patch(':id/cloture')
  @StaffOnly()
  @ApiOperation({ summary: 'Clore une conversation (équipe)' })
  @ApiOkResponse({ schema: toOpenApiSchema(ConversationResponseSchema) })
  close(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<ConversationResponse> {
    return this.messaging.close(id, request.user);
  }
}
