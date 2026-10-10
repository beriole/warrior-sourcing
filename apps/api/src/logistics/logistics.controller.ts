import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BulkAdvanceRequestSchema,
  BulkAdvanceResponseSchema,
  CreateInspectionRequestSchema,
  InspectionReportResponseSchema,
  OpsBoardQuerySchema,
  OpsBoardResponseSchema,
  RecordShipmentEventRequestSchema,
  ShipmentEventResponseSchema,
  TrackedOrderDetailResponseSchema,
  TrackedOrderListResponseSchema,
  type BulkAdvanceData,
  type BulkAdvanceResponse,
  type CreateInspectionData,
  type InspectionReportResponse,
  type OpsBoardQueryData,
  type OpsBoardResponse,
  type RecordShipmentEventData,
  type ShipmentEventResponse,
  type TrackedOrderDetailResponse,
  type TrackedOrderListResponse,
} from '@ws/contracts';
import { AuthGuard, Roles, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { LogisticsService } from './logistics.service.js';

/**
 * Logistique, suivi et inspection (lot LOG).
 * Lecture : un client ne voit que ses commandes. Écriture : agents logistiques et administration,
 * vérifiés côté serveur (§40).
 */
@ApiTags('Logistique')
@Controller('logistics')
@UseGuards(AuthGuard)
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Get('orders')
  @ApiOperation({ summary: 'Mes importations, avec leur étape actuelle' })
  @ApiOkResponse({ schema: toOpenApiSchema(TrackedOrderListResponseSchema) })
  listOrders(@Req() request: AuthenticatedRequest): Promise<TrackedOrderListResponse> {
    return this.logistics.listOwnOrders(request.user.id);
  }

  @Get('board')
  @Roles('LOGISTICS_AGENT', 'CHINA_AGENT', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Vue opérationnelle : une colonne par étape (agents)' })
  @ApiOkResponse({ schema: toOpenApiSchema(OpsBoardResponseSchema) })
  board(
    @Query(new ZodValidationPipe(OpsBoardQuerySchema)) query: OpsBoardQueryData,
  ): Promise<OpsBoardResponse> {
    return this.logistics.board(query);
  }

  @Post('board/advance')
  @Roles('LOGISTICS_AGENT', 'CHINA_AGENT', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Faire passer plusieurs commandes à leur étape suivante' })
  @ApiBody({ schema: toOpenApiSchema(BulkAdvanceRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(BulkAdvanceResponseSchema) })
  bulkAdvance(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(BulkAdvanceRequestSchema)) input: BulkAdvanceData,
  ): Promise<BulkAdvanceResponse> {
    return this.logistics.bulkAdvance(input, request.user);
  }

  @Get('orders/:reference')
  @ApiOperation({ summary: 'Suivi détaillé d’une commande : événements, colis, inspections' })
  @ApiOkResponse({ schema: toOpenApiSchema(TrackedOrderDetailResponseSchema) })
  getOrder(
    @Req() request: AuthenticatedRequest,
    @Param('reference') reference: string,
  ): Promise<TrackedOrderDetailResponse> {
    return this.logistics.getOrder(reference, request.user);
  }

  @Post('orders/:reference/events')
  @Roles('LOGISTICS_AGENT', 'CHINA_AGENT', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Enregistrer un événement logistique et faire avancer la commande' })
  @ApiBody({ schema: toOpenApiSchema(RecordShipmentEventRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(ShipmentEventResponseSchema) })
  recordEvent(
    @Req() request: AuthenticatedRequest,
    @Param('reference') reference: string,
    @Body(new ZodValidationPipe(RecordShipmentEventRequestSchema)) input: RecordShipmentEventData,
  ): Promise<ShipmentEventResponse> {
    return this.logistics.recordEvent(reference, input, request.user);
  }

  @Post('orders/:reference/inspections')
  @Roles('LOGISTICS_AGENT', 'CHINA_AGENT', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Enregistrer un rapport d’inspection (archivé, transmis au client)' })
  @ApiBody({ schema: toOpenApiSchema(CreateInspectionRequestSchema) })
  @ApiOkResponse({ schema: toOpenApiSchema(InspectionReportResponseSchema) })
  createInspection(
    @Req() request: AuthenticatedRequest,
    @Param('reference') reference: string,
    @Body(new ZodValidationPipe(CreateInspectionRequestSchema)) input: CreateInspectionData,
  ): Promise<InspectionReportResponse> {
    return this.logistics.createInspection(reference, input, request.user);
  }
}
