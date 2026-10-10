import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CargoOptionsResponseSchema,
  CreateForwarderRequestSchema,
  CreateFreightRateRequestSchema,
  ForwarderDetailResponseSchema,
  ForwarderListResponseSchema,
  ForwarderResponseSchema,
  ForwarderSearchQuerySchema,
  FreightRateResponseSchema,
  ShippingAddressResponseSchema,
  UpdateForwarderRequestSchema,
  UpdateFreightRateRequestSchema,
  type CargoOptionsResponse,
  type CreateForwarderRequest,
  type CreateFreightRateData,
  type ForwarderDetailResponse,
  type ForwarderListResponse,
  type ForwarderResponse,
  type ForwarderSearchQuery,
  type FreightRateResponse,
  type ShippingAddressResponse,
  type UpdateForwarderRequest,
  type UpdateFreightRateRequest,
} from '@ws/contracts';
import { AuthGuard, Roles, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CargoService } from './cargo.service.js';
import { ShippingAddressService } from './shipping-address.service.js';

/**
 * Transitaires et grilles tarifaires (CARGO-03).
 * Tout ce qui modifie une donnée est réservé à l'administration, vérifié côté serveur (§40).
 * Seule la liste des options du calculateur est ouverte : elle ne contient aucune coordonnée.
 */
@ApiTags('Transitaires')
@Controller('cargo')
export class CargoController {
  constructor(
    private readonly cargo: CargoService,
    private readonly adresses: ShippingAddressService,
  ) {}

  /**
   * Adresse d'expédition à donner au fournisseur chinois (§25).
   *
   * Réservée aux comptes connectés : la réponse contient le **code client**, qui identifie
   * la personne. L'adresse de l'entrepôt, elle, n'a rien de secret — c'est le couple
   * adresse + code qui désigne un destinataire.
   */
  @Get('adresse-expedition')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Adresse de l’entrepôt en Chine, avec le code client du compte',
    description:
      'Assemblée à partir des transitaires saisis en back-office. Rien n’est engendré : un entrepôt sans adresse enregistrée n’est pas servi.',
  })
  @ApiOkResponse({ schema: toOpenApiSchema(ShippingAddressResponseSchema) })
  adresseExpedition(@Req() request: AuthenticatedRequest): Promise<ShippingAddressResponse> {
    return this.adresses.forUser(request.user.id);
  }

  @Get('options')
  @ApiOperation({ summary: 'Transitaires actifs et grilles en vigueur, pour le calculateur' })
  @ApiOkResponse({ schema: toOpenApiSchema(CargoOptionsResponseSchema) })
  options(): Promise<CargoOptionsResponse> {
    return this.cargo.options();
  }

  @Get('forwarders')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Liste et recherche des transitaires (administration)' })
  @ApiOkResponse({ schema: toOpenApiSchema(ForwarderListResponseSchema) })
  list(
    @Query(new ZodValidationPipe(ForwarderSearchQuerySchema)) query: ForwarderSearchQuery,
  ): Promise<ForwarderListResponse> {
    return this.cargo.listForwarders(query);
  }

  @Get('forwarders/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Fiche d’un transitaire et historique complet de ses tarifs' })
  @ApiOkResponse({ schema: toOpenApiSchema(ForwarderDetailResponseSchema) })
  detail(@Param('id') id: string): Promise<ForwarderDetailResponse> {
    return this.cargo.getForwarder(id);
  }

  @Post('forwarders')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Créer un transitaire' })
  @ApiBody({ schema: toOpenApiSchema(CreateForwarderRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(ForwarderResponseSchema) })
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateForwarderRequestSchema)) input: CreateForwarderRequest,
  ): Promise<ForwarderResponse> {
    return this.cargo.createForwarder(input, request.user.id);
  }

  @Patch('forwarders/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Modifier ou désactiver un transitaire' })
  @ApiBody({ schema: toOpenApiSchema(UpdateForwarderRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(ForwarderResponseSchema) })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateForwarderRequestSchema)) input: UpdateForwarderRequest,
  ): Promise<ForwarderResponse> {
    return this.cargo.updateForwarder(id, input);
  }

  @Post('forwarders/:id/rates')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Ajouter une grille tarifaire datée (la précédente est conservée)' })
  @ApiBody({ schema: toOpenApiSchema(CreateFreightRateRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(FreightRateResponseSchema) })
  addRate(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateFreightRateRequestSchema)) input: CreateFreightRateData,
  ): Promise<FreightRateResponse> {
    return this.cargo.addRate(id, input, request.user.id);
  }

  @Patch('rates/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Mettre une grille hors service, ou la remettre en service' })
  @ApiBody({ schema: toOpenApiSchema(UpdateFreightRateRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(FreightRateResponseSchema) })
  updateRate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateFreightRateRequestSchema)) input: UpdateFreightRateRequest,
  ): Promise<FreightRateResponse> {
    return this.cargo.setRateActive(id, input.active);
  }
}
