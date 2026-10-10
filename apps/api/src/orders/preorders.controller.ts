import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  CreateOrderResponseSchema,
  CreatePreorderCampaignRequestSchema,
  isStaff,
  ParticipatePreorderRequestSchema,
  PreorderCampaignListResponseSchema,
  PreorderCampaignResponseSchema,
  UpdatePreorderCampaignRequestSchema,
  type CreateOrderResponse,
  type CreatePreorderCampaignRequest,
  type ParticipatePreorderRequest,
  type PreorderCampaignListResponse,
  type PreorderCampaignResponse,
  type UpdatePreorderCampaignRequest,
} from '@ws/contracts';
import { AuthGuard, Roles, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { OrdersService } from './orders.service.js';
import { PreordersService } from './preorders.service.js';

/**
 * Précommandes (ORD-04, §22). La consultation exige une session ; l'équipe voit aussi les
 * brouillons ; la création et la modification sont réservées à l'administration.
 */
@ApiTags('Précommandes')
@Controller('preorders')
@UseGuards(AuthGuard)
export class PreordersController {
  constructor(
    private readonly preorders: PreordersService,
    private readonly orders: OrdersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Campagnes de précommande, avec leur progression réelle' })
  @ApiOkResponse({ schema: toOpenApiSchema(PreorderCampaignListResponseSchema) })
  list(@Req() request: AuthenticatedRequest): Promise<PreorderCampaignListResponse> {
    return this.preorders.list(isStaff(request.user.role));
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Crée une campagne (administration)' })
  @ApiOkResponse({ schema: toOpenApiSchema(PreorderCampaignResponseSchema) })
  async create(
    @Body(new ZodValidationPipe(CreatePreorderCampaignRequestSchema)) body: CreatePreorderCampaignRequest,
  ): Promise<PreorderCampaignResponse> {
    return { campaign: await this.preorders.create(body) };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Détail d’une campagne : contenu inclus et exclu, délais, conditions, FAQ, progression' })
  @ApiParam({ name: 'slug', description: 'Libellé d’URL de la campagne' })
  @ApiOkResponse({ schema: toOpenApiSchema(PreorderCampaignResponseSchema) })
  async detail(@Param('slug') slug: string, @Req() request: AuthenticatedRequest): Promise<PreorderCampaignResponse> {
    return { campaign: await this.preorders.detail(slug, isStaff(request.user.role)) };
  }

  @Patch(':slug')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Met à jour une campagne (administration)' })
  @ApiParam({ name: 'slug', description: 'Libellé d’URL de la campagne' })
  @ApiOkResponse({ schema: toOpenApiSchema(PreorderCampaignResponseSchema) })
  async update(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(UpdatePreorderCampaignRequestSchema)) body: UpdatePreorderCampaignRequest,
  ): Promise<PreorderCampaignResponse> {
    return { campaign: await this.preorders.update(slug, body) };
  }

  @Post(':slug/participate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Participe à une campagne : commande au prix de la campagne, paiement lancé immédiatement' })
  @ApiParam({ name: 'slug', description: 'Libellé d’URL de la campagne' })
  @ApiOkResponse({ schema: toOpenApiSchema(CreateOrderResponseSchema) })
  participate(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(ParticipatePreorderRequestSchema)) body: ParticipatePreorderRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreateOrderResponse> {
    return this.orders.participate(request.user, slug, body);
  }
}
