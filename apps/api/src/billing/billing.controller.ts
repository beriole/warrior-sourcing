import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  MySubscriptionResponseSchema,
  PromotionInputSchema,
  PublicSubscribeRequestSchema,
  PublicSubscribeResponseSchema,
  SubscribeRequestSchema,
  SubscriptionPlanInputSchema,
  SubscriptionPlansResponseSchema,
  type MySubscriptionResponse,
  type PromotionInput,
  type PublicSubscribeRequest,
  type PublicSubscribeResponse,
  type SubscribeRequest,
  type SubscriptionPlanInput,
  type SubscriptionPlansResponse,
} from '@ws/contracts';
import { AuthGuard, Roles, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { OptionalSession } from '../auth/optional-session.js';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PromotionsService } from './promotions.service.js';
import { SubscriptionsService } from './subscriptions.service.js';

/**
 * Offres, abonnements et promotions (§43).
 *
 * Les offres sont publiques : on doit pouvoir comparer les formules avant de créer un
 * compte. Souscrire exige une session, et la gestion des promotions est réservée à
 * l'administration — une remise est une décision commerciale, pas un réglage.
 */
@ApiTags('Abonnements et promotions')
@Controller()
export class BillingController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly promotions: PromotionsService,
    private readonly session: OptionalSession,
  ) {}

  /** Public : on doit pouvoir comparer les formules avant de créer un compte. */
  @Get('offres')
  @ApiOperation({ summary: 'Offres d’abonnement, avec le prix remisé du compte connecté' })
  @ApiOkResponse({ schema: toOpenApiSchema(SubscriptionPlansResponseSchema) })
  async plans(@Req() request: Request, @Query('code') code?: string): Promise<SubscriptionPlansResponse> {
    return this.subscriptions.plans(await this.session.userId(request), code ?? null);
  }

  /**
   * Souscription sans compte : le compte est créé, et ses identifiants de connexion sont
   * engendrés à la confirmation du paiement. Publique par nécessité — exiger un compte
   * pour s'abonner demande de s'inscrire avant d'avoir vu ce qu'on achète.
   */
  @Post('offres/souscription')
  @ApiOperation({ summary: 'Souscrire sans compte : le compte et ses identifiants sont créés au paiement' })
  @ApiBody({ schema: toOpenApiSchema(PublicSubscribeRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(PublicSubscribeResponseSchema) })
  subscribePublic(
    @Body(new ZodValidationPipe(PublicSubscribeRequestSchema)) input: PublicSubscribeRequest,
  ): Promise<PublicSubscribeResponse> {
    return this.subscriptions.subscribePublic(input);
  }

  @Get('mon-abonnement')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Mon abonnement et mes droits, recalculés à chaque lecture' })
  @ApiOkResponse({ schema: toOpenApiSchema(MySubscriptionResponseSchema) })
  mine(@Req() request: AuthenticatedRequest): Promise<MySubscriptionResponse> {
    return this.subscriptions.mine(request.user.id);
  }

  @Post('mon-abonnement')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Souscrire une offre' })
  @ApiBody({ schema: toOpenApiSchema(SubscribeRequestSchema) })
  subscribe(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(SubscribeRequestSchema)) input: SubscribeRequest,
  ) {
    return this.subscriptions.subscribe(request.user, input);
  }

  @Patch('mon-abonnement/resiliation')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Résilier : les droits courent jusqu’au terme déjà payé' })
  @ApiOkResponse({ schema: toOpenApiSchema(MySubscriptionResponseSchema) })
  cancel(@Req() request: AuthenticatedRequest): Promise<MySubscriptionResponse> {
    return this.subscriptions.cancel(request.user.id);
  }

  // ───────────────────────── Back-office ─────────────────────────

  @Get('admin/offres')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Offres d’abonnement, avec le nombre d’abonnés' })
  adminPlans() {
    return this.subscriptions.adminPlans();
  }

  @Post('admin/offres')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Créer une offre' })
  @ApiBody({ schema: toOpenApiSchema(SubscriptionPlanInputSchema) })
  createPlan(@Body(new ZodValidationPipe(SubscriptionPlanInputSchema)) input: SubscriptionPlanInput) {
    return this.subscriptions.createPlan(input);
  }

  @Put('admin/offres/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Modifier une offre : prix, droits, avantages' })
  @ApiBody({ schema: toOpenApiSchema(SubscriptionPlanInputSchema) })
  updatePlan(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SubscriptionPlanInputSchema)) input: SubscriptionPlanInput,
  ) {
    return this.subscriptions.updatePlan(id, input);
  }

  @Get('admin/promotions')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Promotions, avec leur état réel et leurs utilisations' })
  listPromotions() {
    return this.promotions.list();
  }

  @Post('admin/promotions')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Créer une promotion' })
  @ApiBody({ schema: toOpenApiSchema(PromotionInputSchema) })
  createPromotion(@Body(new ZodValidationPipe(PromotionInputSchema)) input: PromotionInput) {
    return this.promotions.create(input);
  }

  @Put('admin/promotions/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Modifier une promotion' })
  @ApiBody({ schema: toOpenApiSchema(PromotionInputSchema) })
  updatePromotion(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PromotionInputSchema)) input: PromotionInput,
  ) {
    return this.promotions.update(id, input);
  }

  /** Une promotion qui a servi ne se supprime pas : le service refuse et explique. */
  @Delete('admin/promotions/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Supprimer une promotion qui n’a jamais servi' })
  removePromotion(@Param('id') id: string) {
    return this.promotions.remove(id);
  }
}
