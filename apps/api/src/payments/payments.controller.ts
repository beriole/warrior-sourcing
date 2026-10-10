import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Env } from '../config/env.js';
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
    private readonly config: ConfigService<Env, true>,
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

  /**
   * Réconciliation déclenchée par une tâche planifiée (cron Vercel).
   *
   * En sans-serveur, le processus ne vit pas entre deux requêtes : le `setInterval` du
   * module ne se déclenche jamais. Sans ce rappel extérieur, un paiement validé sur le
   * téléphone resterait « en attente » jusqu'à ce que quelqu'un ouvre la page — et le
   * webhook, s'il se perd, ne serait jamais rattrapé.
   *
   * En GET parce que c'est ce que les crons savent appeler, et l'opération est idempotente :
   * elle relit des états chez l'agrégateur et n'écrit que des transitions légitimes.
   */
  @Get('reconciliation-planifiee')
  @ApiOperation({ summary: 'Réconciliation des paiements, appelée par une tâche planifiée' })
  @ApiOkResponse({ schema: toOpenApiSchema(ReconcileResponseSchema) })
  reconcileCron(@Headers('authorization') autorisation: string | undefined): Promise<ReconcileResponse> {
    const attendu = this.config.get('CRON_SECRET', { infer: true });
    // Secret absent : personne ne passe. Une route qui interroge l'agrégateur ne doit
    // pas s'ouvrir parce qu'une variable d'environnement a été oubliée.
    if (!attendu || !memeSecret(autorisation, attendu)) {
      throw new UnauthorizedException({ message: 'Tâche planifiée non authentifiée.', code: 'cron_rejected' });
    }
    return this.payments.reconcilePending();
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

/**
 * Comparaison à temps constant de l'en-tête `Authorization: Bearer <secret>`.
 *
 * `===` sur un secret se compare caractère par caractère et s'arrête au premier écart :
 * le temps de réponse renseigne alors sur le préfixe correct. Le risque est faible ici,
 * la précaution ne coûte rien.
 */
function memeSecret(autorisation: string | undefined, attendu: string): boolean {
  if (!autorisation?.startsWith('Bearer ')) return false;
  const recu = Buffer.from(autorisation.slice('Bearer '.length));
  const reference = Buffer.from(attendu);
  return recu.length === reference.length && timingSafeEqual(recu, reference);
}
