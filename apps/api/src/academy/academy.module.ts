import { Module } from '@nestjs/common';
import { OptionalSession } from '../auth/optional-session.js';
import { AccessActivationModule } from '../billing/access-activation.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { AcademySession } from './academy-session.js';
import { CoursePurchaseService } from './course-purchase.service.js';
import { AcademyController } from './academy.controller.js';
import { AcademyService } from './academy.service.js';
import { AcademyMedia } from './media.js';

/**
 * Formations, leçons et progression (lot ACA).
 * Déclarer ici les contrôleurs et services du lot : le module racine est déjà branché.
 *
 * `PrismaService` et `MailService` viennent des modules globaux ; `AcademyMedia` signe les
 * liens de lecture Cloudinary (DEC-04) et reste dans ce lot, car le lot PLAT ne signe que
 * les envois, pas les livraisons.
 *
 * L'achat à l'unité (SUB-02) emprunte le moteur de promotions du lot SUB et l'encaissement
 * du lot PAY : un prix et une remise ne se calculent qu'à un seul endroit.
 */
@Module({
  imports: [BillingModule, PaymentsModule, AccessActivationModule],
  controllers: [AcademyController],
  providers: [AcademyService, AcademySession, AcademyMedia, CoursePurchaseService, OptionalSession],
  exports: [AcademyService],
})
export class AcademyModule {}
