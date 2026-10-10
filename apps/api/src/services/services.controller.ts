import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AddServiceDeliverableRequestSchema,
  AdvanceServiceOrderRequestSchema,
  CreateServiceOrderRequestSchema,
  CreateServiceOrderResponseSchema,
  RetryServiceOrderPaymentRequestSchema,
  ServiceCatalogQuerySchema,
  ServiceCatalogResponseSchema,
  ServiceDetailResponseSchema,
  ServiceOrderListResponseSchema,
  ServiceOrderQuerySchema,
  ServiceOrderResponseSchema,
  type AddServiceDeliverableRequest,
  type AdvanceServiceOrderRequest,
  type CreateServiceOrderRequest,
  type CreateServiceOrderResponse,
  type RetryServiceOrderPaymentRequest,
  type ServiceCatalogQuery,
  type ServiceCatalogResponse,
  type ServiceDetailResponse,
  type ServiceOrderListResponse,
  type ServiceOrderQuery,
  type ServiceOrderResponse,
} from '@ws/contracts';
import { AuthGuard, StaffOnly, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ServicesService } from './services.service.js';

/**
 * Prestations (lot SRV, §29).
 *
 * Le catalogue est public : on doit pouvoir lire ce que coûte une inspection avant de se
 * créer un compte. Tout ce qui engage — commander, payer, suivre — exige une session, et
 * l'avancement de l'exécution est réservé à l'équipe.
 */
@ApiTags('Prestations')
@Controller()
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  // ───────────────────────── Catalogue, public ─────────────────────────

  @Get('services')
  @ApiOperation({ summary: 'Catalogue des prestations, filtrable par catégorie et par budget' })
  @ApiOkResponse({ schema: toOpenApiSchema(ServiceCatalogResponseSchema) })
  catalog(
    @Query(new ZodValidationPipe(ServiceCatalogQuerySchema)) query: ServiceCatalogQuery,
  ): Promise<ServiceCatalogResponse> {
    return this.services.catalog(query);
  }

  @Get('services/:slug')
  @ApiOperation({ summary: 'Fiche d’une prestation : livrables, conditions, délai, tarif' })
  @ApiOkResponse({ schema: toOpenApiSchema(ServiceDetailResponseSchema) })
  detail(@Param('slug') slug: string): Promise<ServiceDetailResponse> {
    return this.services.detail(slug);
  }

  // ───────────────────────── Commandes, client connecté ─────────────────────────

  @Post('service-orders')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Commander une prestation et lancer son paiement' })
  @ApiBody({ schema: toOpenApiSchema(CreateServiceOrderRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(CreateServiceOrderResponseSchema) })
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateServiceOrderRequestSchema)) input: CreateServiceOrderRequest,
  ): Promise<CreateServiceOrderResponse> {
    return this.services.create(request.user, input);
  }

  @Get('service-orders')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Mes commandes de prestation' })
  @ApiOkResponse({ schema: toOpenApiSchema(ServiceOrderListResponseSchema) })
  list(
    @Req() request: AuthenticatedRequest,
    @Query(new ZodValidationPipe(ServiceOrderQuerySchema)) query: ServiceOrderQuery,
  ): Promise<ServiceOrderListResponse> {
    return this.services.list(request.user.id, query);
  }

  @Get('service-orders/:reference')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Suivi d’une commande de prestation et ses livrables' })
  @ApiOkResponse({ schema: toOpenApiSchema(ServiceOrderResponseSchema) })
  findOne(
    @Param('reference') reference: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ServiceOrderResponse> {
    return this.services.findOne(reference, request.user);
  }

  @Post('service-orders/:reference/payment')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Relancer le paiement d’une commande restée impayée' })
  @ApiBody({ schema: toOpenApiSchema(RetryServiceOrderPaymentRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(CreateServiceOrderResponseSchema) })
  retryPayment(
    @Param('reference') reference: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(RetryServiceOrderPaymentRequestSchema)) input: RetryServiceOrderPaymentRequest,
  ): Promise<CreateServiceOrderResponse> {
    return this.services.retryPayment(reference, request.user, input);
  }

  @Patch('service-orders/:reference/annulation')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Annuler une demande tant qu’elle n’est pas payée' })
  @ApiOkResponse({ schema: toOpenApiSchema(ServiceOrderResponseSchema) })
  cancel(
    @Param('reference') reference: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ServiceOrderResponse> {
    return this.services.cancel(reference, request.user);
  }

  // ───────────────────────── Exécution, équipe ─────────────────────────

  @Patch('service-orders/:reference/etat')
  @UseGuards(AuthGuard)
  @StaffOnly()
  @ApiOperation({ summary: 'Faire avancer l’exécution (équipe)' })
  @ApiBody({ schema: toOpenApiSchema(AdvanceServiceOrderRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(ServiceOrderResponseSchema) })
  advance(
    @Param('reference') reference: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(AdvanceServiceOrderRequestSchema)) input: AdvanceServiceOrderRequest,
  ): Promise<ServiceOrderResponse> {
    return this.services.advance(reference, request.user, input);
  }

  @Post('service-orders/:reference/livrables')
  @UseGuards(AuthGuard)
  @StaffOnly()
  @ApiOperation({ summary: 'Déposer un livrable sur une prestation payée (équipe)' })
  @ApiBody({ schema: toOpenApiSchema(AddServiceDeliverableRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(ServiceOrderResponseSchema) })
  addDeliverable(
    @Param('reference') reference: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(AddServiceDeliverableRequestSchema)) input: AddServiceDeliverableRequest,
  ): Promise<ServiceOrderResponse> {
    return this.services.addDeliverable(reference, request.user, input);
  }
}
