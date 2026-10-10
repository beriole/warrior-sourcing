import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BusinessProjectInputSchema,
  BusinessProjectListResponseSchema,
  BusinessProjectResponseSchema,
  BusinessSaleInputSchema,
  type BusinessProjectInput,
  type BusinessProjectListResponse,
  type BusinessProjectResponse,
  type BusinessSaleInput,
} from '@ws/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { BusinessLabService } from './business-lab.service.js';

/**
 * Business Lab (lot LAB, §27).
 *
 * Tout est privé : un projet commercial, c'est la comptabilité de quelqu'un. Rien ici
 * n'est public, et rien n'est partagé sans un acte explicite — la publication d'une
 * Import Story (LAB-03) sera une route à part, avec son consentement.
 */
@ApiTags('Business Lab')
@Controller('business-lab/projets')
@UseGuards(AuthGuard)
export class BusinessLabController {
  constructor(private readonly lab: BusinessLabService) {}

  @Get()
  @ApiOperation({ summary: 'Mes projets commerciaux et leurs indicateurs' })
  @ApiOkResponse({ schema: toOpenApiSchema(BusinessProjectListResponseSchema) })
  list(@Req() request: AuthenticatedRequest): Promise<BusinessProjectListResponse> {
    return this.lab.list(request.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Ouvrir un projet commercial' })
  @ApiBody({ schema: toOpenApiSchema(BusinessProjectInputSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(BusinessProjectResponseSchema) })
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(BusinessProjectInputSchema)) input: BusinessProjectInput,
  ): Promise<BusinessProjectResponse> {
    return this.lab.create(request.user.id, input);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Un projet, ses ventes et ses indicateurs' })
  @ApiOkResponse({ schema: toOpenApiSchema(BusinessProjectResponseSchema) })
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<BusinessProjectResponse> {
    return this.lab.findOne(id, request.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Corriger un projet' })
  @ApiBody({ schema: toOpenApiSchema(BusinessProjectInputSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(BusinessProjectResponseSchema) })
  update(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(BusinessProjectInputSchema)) input: BusinessProjectInput,
  ): Promise<BusinessProjectResponse> {
    return this.lab.update(id, request.user.id, input);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un projet et ses ventes' })
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<{ deleted: true }> {
    return this.lab.remove(id, request.user.id);
  }

  @Post(':id/ventes')
  @ApiOperation({ summary: 'Saisir une vente' })
  @ApiBody({ schema: toOpenApiSchema(BusinessSaleInputSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(BusinessProjectResponseSchema) })
  addSale(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(BusinessSaleInputSchema)) input: BusinessSaleInput,
  ): Promise<BusinessProjectResponse> {
    return this.lab.addSale(id, request.user.id, input);
  }

  @Delete(':id/ventes/:saleId')
  @ApiOperation({ summary: 'Retirer une vente saisie par erreur' })
  @ApiOkResponse({ schema: toOpenApiSchema(BusinessProjectResponseSchema) })
  removeSale(
    @Param('id') id: string,
    @Param('saleId') saleId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<BusinessProjectResponse> {
    return this.lab.removeSale(id, saleId, request.user.id);
  }
}
