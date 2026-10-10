import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  PaymentResponseSchema,
  PaymentStateResponseSchema,
  ReconcileResponseSchema,
  WebhookAckResponseSchema,
  type PaymentResponse,
  type PaymentStateResponse,
  type ReconcileResponse,
  type WebhookAckResponse,
} from '@ws/contracts';
import { AuthGuard, Roles, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { toOpenApiSchema } from '../common/zod-validation.pipe.js';
import { PaymentsService } from './payments.service.js';
import { Inject } from '@nestjs/common';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';

/** Paiements Mobile Money (PAY-01). Aucune donnée de carte ne transite ici (PAY-02). */
@ApiTags('Paiements')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Webhook de l’agrégateur',
    description:
      'Vérifié par l’en-tête x-wh-secret. L’état reçu est confirmé auprès de l’agrégateur avant toute écriture ; un webhook rejoué est ignoré.',
  })
  @ApiOkResponse({ schema: toOpenApiSchema(WebhookAckResponseSchema) })
  async webhook(@Headers('x-wh-secret') secret: string | undefined, @Body() body: unknown): Promise<WebhookAckResponse> {
    if (!this.provider.verifyWebhookSecret(secret)) {
      throw new UnauthorizedException({ message: 'Webhook non authentifié.', code: 'webhook_rejected' });
    }
    return this.payments.handleWebhook(secret, body);
  }

  /**
   * État d'un paiement, sans session. Sert au parcours d'abonnement sans compte : l'écran
   * doit pouvoir dire « c'est confirmé » à quelqu'un qui n'a pas encore ses identifiants.
   * Ne renvoie que l'état et sa consigne — rien qui désigne un client.
   */
  @Get(':reference/etat')
  @ApiOperation({ summary: 'État d’un paiement, sans session : état, consigne, et rien d’autre' })
  @ApiParam({ name: 'reference', description: 'Référence du paiement (PAY-…)' })
  @ApiOkResponse({ schema: toOpenApiSchema(PaymentStateResponseSchema) })
  state(@Param('reference') reference: string): Promise<PaymentStateResponse> {
    return this.payments.stateFor(reference);
  }

  @Get(':reference')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'État d’un paiement du client connecté, rafraîchi auprès de l’agrégateur si nécessaire' })
  @ApiParam({ name: 'reference', description: 'Référence du paiement (PAY-…)' })
  @ApiOkResponse({ schema: toOpenApiSchema(PaymentResponseSchema) })
  async find(@Param('reference') reference: string, @Req() request: AuthenticatedRequest): Promise<PaymentResponse> {
    return { payment: await this.payments.findForUser(reference, request.user.id) };
  }

  @Post('reconcile')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Réconciliation des paiements en attente (administration)' })
  @ApiOkResponse({ schema: toOpenApiSchema(ReconcileResponseSchema) })
  reconcile(): Promise<ReconcileResponse> {
    return this.payments.reconcilePending();
  }
}
