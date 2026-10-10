import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { CalculatorController } from './calculator/calculator.controller.js';
import { CargoModule } from './cargo/cargo.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { LogisticsModule } from './logistics/logistics.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { AcademyModule } from './academy/academy.module.js';
import { BusinessLabModule } from './business-lab/business-lab.module.js';
import { BillingModule } from './billing/billing.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { ServicesModule } from './services/services.module.js';
import { AdminModule } from './admin/admin.module.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { validateEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { MailModule } from './mail/mail.module.js';
import { OnboardingController } from './onboarding/onboarding.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Limitation de débit (§41). En production multi-instance : stockage Redis.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    MailModule.register(process.env.NODE_ENV === 'production'),
    CargoModule,
    CatalogModule,
    SuppliersModule,
    OrdersModule,
    PaymentsModule,
    LogisticsModule,
    PlatformModule,
    AcademyModule,
    BusinessLabModule,
    MessagingModule,
    BillingModule,
    ServicesModule,
    AdminModule,
  ],
  controllers: [HealthController, CalculatorController, OnboardingController, DashboardController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
