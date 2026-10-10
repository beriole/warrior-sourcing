import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountProvisioning } from './account-provisioning.js';
import { createAuth, type Auth } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AUTH } from './auth.tokens.js';
import { EmailOtpSender, OtpSender } from './otp-sender.js';

export { AUTH };

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    { provide: OtpSender, useClass: EmailOtpSender },
    {
      provide: AUTH,
      inject: [ConfigService, PrismaService, OtpSender],
      useFactory: (config: ConfigService<Env, true>, prisma: PrismaService, otp: OtpSender): Auth =>
        createAuth(config, prisma, otp),
    },
    AuthGuard,
    AccountProvisioning,
  ],
  exports: [AUTH, AuthGuard, OtpSender, AccountProvisioning],
})
export class AuthModule {}
