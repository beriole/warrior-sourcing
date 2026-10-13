import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthResponseSchema } from '@ws/contracts';
import { toOpenApiSchema } from '../common/zod-validation.pipe.js';
import { MailService } from '../mail/mail.service.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payments/payment-provider.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('Santé')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @Inject(PAYMENT_PROVIDER) private readonly paiements: PaymentProvider,
  ) { }

  @Get()
  @ApiOkResponse({ schema: toOpenApiSchema(HealthResponseSchema) })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' });
    }
    return { status: 'ok', database: 'up', email: this.mail.moyen, paiements: this.paiements.name };
  }
}
