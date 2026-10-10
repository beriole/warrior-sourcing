import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  CreateSupplierRequestBodySchema,
  RecordSupplierVerificationBodySchema,
  RecordSupplierVerificationResponseSchema,
  SupplierContactResponseSchema,
  SupplierDetailResponseSchema,
  SupplierListQuerySchema,
  SupplierListResponseSchema,
  SupplierRequestResponseSchema,
  type CreateSupplierRequestBody,
  type RecordSupplierVerificationBody,
  type RecordSupplierVerificationResponse,
  type SupplierContactResponse,
  type SupplierDetailResponse,
  type SupplierListQuery,
  type SupplierListResponse,
  type SupplierRequestResponse,
  type UserRole,
} from '@ws/contracts';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { Auth } from '../auth/auth.config.js';
import { AuthGuard, Roles, StaffOnly, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { AUTH } from '../auth/auth.tokens.js';
import { ZodValidationPipe, toOpenApiSchema } from '../common/zod-validation.pipe.js';
import { SUPPLIER_CONTACT_ROLES, SuppliersService } from './suppliers.service.js';

/**
 * Fournisseurs (§15 à §19).
 *
 * La liste et la fiche sont publiques : c'est l'aperçu du cahier (§17).
 * Les coordonnées ont leur propre route, protégée par le garde et par un contrôle de rôle.
 */
@ApiTags('Fournisseurs')
@Controller('suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liste des fournisseurs, avec recherche et filtres' })
  @ApiQuery({ name: 'q', required: false, description: 'Recherche sur le nom du fournisseur ou d’un produit' })
  @ApiQuery({ name: 'category', required: false, description: 'Catégorie de produit' })
  @ApiQuery({ name: 'city', required: false, description: 'Ville du fournisseur' })
  @ApiQuery({ name: 'type', required: false, description: 'Usine, distributeur ou société de négoce' })
  @ApiQuery({ name: 'moqMax', required: false, description: 'Quantité minimale de commande maximale acceptée' })
  @ApiQuery({ name: 'customization', required: false, description: 'true pour la personnalisation possible' })
  @ApiQuery({ name: 'sample', required: false, description: 'true pour un échantillon disponible' })
  @ApiQuery({ name: 'minLevel', required: false, description: 'Niveau de vérification minimal prouvé' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({ schema: toOpenApiSchema(SupplierListResponseSchema) })
  async list(
    @Query(new ZodValidationPipe(SupplierListQuerySchema)) query: SupplierListQuery,
  ): Promise<SupplierListResponse> {
    return this.suppliers.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Aperçu public d’une fiche fournisseur, sans aucune coordonnée' })
  @ApiOkResponse({ schema: toOpenApiSchema(SupplierDetailResponseSchema) })
  async detail(@Param('id') id: string, @Req() request: Request): Promise<SupplierDetailResponse> {
    // Fiche publique : la session est facultative, elle sert seulement à dire si les
    // coordonnées sont accessibles. Leur contenu, lui, ne transite jamais par cette route.
    return this.suppliers.detail(id, await this.roleOf(request));
  }

  @Get(':id/contact')
  @UseGuards(AuthGuard)
  @Roles(...SUPPLIER_CONTACT_ROLES)
  @ApiOperation({ summary: 'Coordonnées du fournisseur, réservées aux membres (§17)' })
  @ApiOkResponse({ schema: toOpenApiSchema(SupplierContactResponseSchema) })
  async contact(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<SupplierContactResponse> {
    return this.suppliers.contact(id, request.user.id, request.user.role);
  }

  @Post(':id/verifications')
  @UseGuards(AuthGuard)
  @StaffOnly()
  @ApiOperation({ summary: 'Enregistrer une preuve et faire passer un niveau de vérification (§16)' })
  @ApiOkResponse({ schema: toOpenApiSchema(RecordSupplierVerificationResponseSchema) })
  async recordVerification(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RecordSupplierVerificationBodySchema)) body: RecordSupplierVerificationBody,
    @Req() request: AuthenticatedRequest,
  ): Promise<RecordSupplierVerificationResponse> {
    return this.suppliers.recordVerification(id, body, request.user.id);
  }

  @Post(':id/requests')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Demander un devis ou un sourcing auprès de ce fournisseur' })
  @ApiOkResponse({ schema: toOpenApiSchema(SupplierRequestResponseSchema) })
  async createRequest(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateSupplierRequestBodySchema)) body: CreateSupplierRequestBody,
    @Req() request: AuthenticatedRequest,
  ): Promise<SupplierRequestResponse> {
    return this.suppliers.createRequest(id, body, request.user.id);
  }

  /** Rôle du visiteur, ou `null` s'il n'est pas connecté. Aucune erreur en cas d'absence de session. */
  private async roleOf(request: Request): Promise<UserRole | null> {
    const session = await this.auth.api
      .getSession({ headers: fromNodeHeaders(request.headers) })
      .catch(() => null);
    return (session?.user as { role?: UserRole } | undefined)?.role ?? null;
  }
}
