import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  CatalogListResponseSchema,
  CatalogProductResponseSchema,
  CatalogQuerySchema,
  InvestmentSimulationRequestSchema,
  InvestmentSimulationResponseSchema,
  type CatalogListResponse,
  type CatalogProductResponse,
  type CatalogQuery,
  type InvestmentSimulationRequest,
  type InvestmentSimulationResponse,
} from '@ws/contracts';
import type { Request } from 'express';
import { ZodValidationPipe, toOpenApiSchema } from '../common/zod-validation.pipe.js';
import { CatalogService } from './catalog.service.js';
import { OptionalSession } from '../auth/optional-session.js';

/**
 * Publie les filtres de la liste dans la documentation à partir du schéma Zod :
 * un filtre ajouté au contrat apparaît dans OpenAPI sans qu'on l'y recopie.
 */
function ApiCatalogQuery() {
  const schema = toOpenApiSchema(CatalogQuerySchema) as {
    properties?: Record<string, Record<string, unknown>>;
  };
  const properties = Object.entries(schema.properties ?? {});

  return applyDecorators(
    ...properties.map(([name, property]) => ApiQuery({ name, required: false, schema: property })),
  );
}

/** Produits et opportunités (§12, §13, §14). Consultable sans compte. */
@ApiTags('Catalogue')
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly session: OptionalSession,
  ) {}

  @Get('products')
  @ApiOperation({
    summary: 'Liste paginée des opportunités, par onglet et par filtres',
    description:
      'Le classement « Pour vous » utilise le profil d’importateur de la session quand il existe ; sinon la liste est classée du moins cher au plus cher.',
  })
  @ApiCatalogQuery()
  @ApiOkResponse({ schema: toOpenApiSchema(CatalogListResponseSchema) })
  async list(
    @Query(new ZodValidationPipe(CatalogQuerySchema)) query: CatalogQuery,
    @Req() request: Request,
  ): Promise<CatalogListResponse> {
    const profile = query.tab === 'FOR_YOU' ? await this.session.importerProfile(request) : null;
    return this.catalog.list(query, profile);
  }

  @Get('products/:idOrSlug')
  @ApiOperation({ summary: 'Fiche produit : coûts estimés, prix local daté, points de vigilance' })
  @ApiParam({ name: 'idOrSlug', description: 'Identifiant du produit ou libellé de son URL' })
  @ApiOkResponse({ schema: toOpenApiSchema(CatalogProductResponseSchema) })
  async product(@Param('idOrSlug') idOrSlug: string): Promise<CatalogProductResponse> {
    return { product: await this.catalog.product(idOrSlug) };
  }

  @Post('products/:idOrSlug/simulate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Simulateur d’investissement : un budget donne quantité, marge, ROI et seuil',
    description: 'Le résultat est une estimation accompagnée de ses hypothèses, jamais une garantie.',
  })
  @ApiParam({ name: 'idOrSlug', description: 'Identifiant du produit ou libellé de son URL' })
  @ApiOkResponse({ schema: toOpenApiSchema(InvestmentSimulationResponseSchema) })
  async simulate(
    @Param('idOrSlug') idOrSlug: string,
    @Body(new ZodValidationPipe(InvestmentSimulationRequestSchema)) body: InvestmentSimulationRequest,
  ): Promise<InvestmentSimulationResponse> {
    return this.catalog.simulate(idOrSlug, body.budgetXaf);
  }
}
