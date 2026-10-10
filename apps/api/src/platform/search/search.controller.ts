import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AddFavoriteRequestSchema,
  FavoriteListResponseSchema,
  FavoriteMutationResponseSchema,
  FavoriteQuerySchema,
  FavoriteTargetTypeSchema,
  GlobalSearchQuerySchema,
  GlobalSearchResponseSchema,
  type AddFavoriteRequest,
  type FavoriteListResponse,
  type FavoriteMutationResponse,
  type FavoriteQuery,
  type GlobalSearchQuery,
  type GlobalSearchResponse,
} from '@ws/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../../auth/auth.guard.js';
import { toOpenApiSchema, ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { FavoritesService } from '../favorites/favorites.service.js';
import { SearchService } from './search.service.js';

/**
 * Recherche globale et favoris (PLAT-08, PLAT-09, §36).
 *
 * La recherche est publique : on doit pouvoir chercher un produit avant d'avoir un compte.
 * Les favoris appartiennent à un compte, donc ils exigent une session.
 */
@ApiTags('Recherche et favoris')
@Controller()
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly favorites: FavoritesService,
  ) {}

  @Get('recherche')
  @ApiOperation({ summary: 'Recherche unifiée produits, fournisseurs, formations et prestations' })
  @ApiOkResponse({ schema: toOpenApiSchema(GlobalSearchResponseSchema) })
  globalSearch(
    @Query(new ZodValidationPipe(GlobalSearchQuerySchema)) query: GlobalSearchQuery,
  ): Promise<GlobalSearchResponse> {
    return this.search.search(query);
  }

  @Get('favoris')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Mes favoris, toutes familles confondues' })
  @ApiOkResponse({ schema: toOpenApiSchema(FavoriteListResponseSchema) })
  listFavorites(
    @Req() request: AuthenticatedRequest,
    @Query(new ZodValidationPipe(FavoriteQuerySchema)) query: FavoriteQuery,
  ): Promise<FavoriteListResponse> {
    return this.favorites.list(request.user.id, query);
  }

  @Post('favoris')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Mettre une fiche en favori (idempotent)' })
  @ApiBody({ schema: toOpenApiSchema(AddFavoriteRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(FavoriteMutationResponseSchema) })
  addFavorite(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(AddFavoriteRequestSchema)) input: AddFavoriteRequest,
  ): Promise<FavoriteMutationResponse> {
    return this.favorites.add(request.user.id, input);
  }

  @Delete('favoris/:targetType/:targetId')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Retirer une fiche des favoris (idempotent)' })
  @ApiOkResponse({ schema: toOpenApiSchema(FavoriteMutationResponseSchema) })
  removeFavorite(
    @Req() request: AuthenticatedRequest,
    @Param('targetType', new ZodValidationPipe(FavoriteTargetTypeSchema))
    targetType: AddFavoriteRequest['targetType'],
    @Param('targetId') targetId: string,
  ): Promise<FavoriteMutationResponse> {
    return this.favorites.remove(request.user.id, targetType, targetId);
  }
}
