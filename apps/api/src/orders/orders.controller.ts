import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  CheckoutQuoteRequestSchema,
  CheckoutQuoteResponseSchema,
  CreateOrderRequestSchema,
  CreateOrderResponseSchema,
  OrderListResponseSchema,
  OrderResponseSchema,
  type CheckoutQuoteRequest,
  type CheckoutQuoteResponse,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type OrderListResponse,
  type OrderResponse,
} from '@ws/contracts';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthGuard, Roles, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { toOpenApiSchema, ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { OrdersService } from './orders.service.js';
import { buildReceiptPdf } from './receipt.js';

/** Relance de paiement : les mêmes champs que le checkout, sans le produit ni la réception. */
const RetryPaymentRequestSchema = CreateOrderRequestSchema.pick({ paymentMethod: true, payerPhone: true });
type RetryPaymentRequest = z.infer<typeof RetryPaymentRequestSchema>;

/**
 * Commandes (ORD-01, ORD-02, ORD-03, ORD-05).
 * Toutes les routes exigent une session ; un client ne voit que ses commandes (§40).
 */
@ApiTags('Commandes')
@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('quote')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Résumé complet des frais avant paiement',
    description: 'Même calcul que la commande, sans rien enregistrer. Les frais hors marchandise sont des estimations accompagnées de leurs hypothèses.',
  })
  @ApiOkResponse({ schema: toOpenApiSchema(CheckoutQuoteResponseSchema) })
  quote(@Body(new ZodValidationPipe(CheckoutQuoteRequestSchema)) body: CheckoutQuoteRequest): Promise<CheckoutQuoteResponse> {
    return this.orders.quote(body);
  }

  @Post()
  @ApiOperation({
    summary: 'Crée une commande et pousse la demande de paiement sur le téléphone',
    description: 'Le total est calculé côté serveur. La commande reste « en attente de paiement » jusqu’à confirmation par l’agrégateur.',
  })
  @ApiOkResponse({ schema: toOpenApiSchema(CreateOrderResponseSchema) })
  create(
    @Body(new ZodValidationPipe(CreateOrderRequestSchema)) body: CreateOrderRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreateOrderResponse> {
    return this.orders.create(request.user, body);
  }

  @Get()
  @ApiOperation({ summary: 'Historique des commandes du client connecté' })
  @ApiOkResponse({ schema: toOpenApiSchema(OrderListResponseSchema) })
  list(@Req() request: AuthenticatedRequest): Promise<OrderListResponse> {
    return this.orders.listForUser(request.user.id);
  }

  @Get('all')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Toutes les commandes (administration)' })
  @ApiOkResponse({ schema: toOpenApiSchema(OrderListResponseSchema) })
  listAll(): Promise<OrderListResponse> {
    return this.orders.listAll();
  }

  @Get(':reference')
  @ApiOperation({ summary: 'Détail d’une commande du client connecté, avec l’état de son paiement' })
  @ApiParam({ name: 'reference', description: 'Référence de la commande (WS-…)' })
  @ApiOkResponse({ schema: toOpenApiSchema(OrderResponseSchema) })
  async detail(@Param('reference') reference: string, @Req() request: AuthenticatedRequest): Promise<OrderResponse> {
    return { order: await this.orders.detailForUser(reference, request.user.id) };
  }

  @Post(':reference/pay')
  @HttpCode(200)
  @ApiOperation({ summary: 'Relance une demande de paiement sur une commande impayée' })
  @ApiParam({ name: 'reference', description: 'Référence de la commande (WS-…)' })
  @ApiOkResponse({ schema: toOpenApiSchema(CreateOrderResponseSchema) })
  retry(
    @Param('reference') reference: string,
    @Body(new ZodValidationPipe(RetryPaymentRequestSchema)) body: RetryPaymentRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreateOrderResponse> {
    return this.orders.retryPayment(request.user, reference, body);
  }

  @Get(':reference/receipt.pdf')
  @ApiOperation({ summary: 'Reçu de paiement au format PDF, disponible une fois le paiement confirmé' })
  @ApiParam({ name: 'reference', description: 'Référence de la commande (WS-…)' })
  @ApiProduces('application/pdf')
  async receipt(@Param('reference') reference: string, @Req() request: AuthenticatedRequest, @Res() response: Response): Promise<void> {
    const data = await this.orders.receiptData(reference, request.user.id);
    const pdf = await buildReceiptPdf(data);
    response
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `inline; filename="recu-${data.order.reference}.pdf"`)
      .setHeader('Cache-Control', 'private, no-store')
      .send(Buffer.from(pdf));
  }
}
