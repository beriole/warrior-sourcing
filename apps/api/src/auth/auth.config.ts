import type { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP } from 'better-auth/plugins/email-otp';
import type { Env } from '../config/env.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { OtpSender } from './otp-sender.js';

/** Chemin de montage du gestionnaire Better Auth, identique côté serveur et client. */
export const AUTH_BASE_PATH = '/v1/auth';

/**
 * Numéro camerounais au format international : +237 puis un mobile à 9 chiffres commençant
 * par 6. Le numéro n'est plus un identifiant de connexion, mais il reste vérifié quand il est
 * saisi dans le profil : c'est lui qui sert au paiement Mobile Money et à la livraison.
 */
export function isAcceptedPhoneNumber(value: string): boolean {
  if (value.startsWith('+237')) return /^\+2376\d{8}$/.test(value);
  return /^\+[1-9]\d{7,14}$/.test(value);
}

export function createAuth(config: ConfigService<Env, true>, prisma: PrismaService, otp: OtpSender) {
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';
  /**
   * Voir `AUTH_COOKIE_SAMESITE` dans config/env.ts : c'est ce réglage qui décide si la
   * session survit à un déploiement où le site et l'API ne sont pas sur le même domaine.
   */
  const sameSite = config.get('AUTH_COOKIE_SAMESITE', { infer: true });

  return betterAuth({
    appName: 'Warrior Sourcing',
    baseURL: config.get('API_URL', { infer: true }),
    basePath: AUTH_BASE_PATH,
    secret: config.get('AUTH_SECRET', { infer: true }),
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    trustedOrigins: [config.get('WEB_ORIGIN', { infer: true }), config.get('ADMIN_ORIGIN', { infer: true })],

    /** Réservé à l'équipe interne : les clients se connectent par code email. */
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      autoSignIn: false,
    },

    user: {
      additionalFields: {
        // Le rôle reste piloté côté serveur : jamais modifiable depuis une requête client.
        role: { type: 'string', defaultValue: 'CLIENT', input: false },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },

    advanced: {
      defaultCookieAttributes: {
        sameSite,
        // `SameSite=None` sans `Secure` est refusé par les navigateurs : le cookie serait
        // simplement ignoré. On ne laisse donc pas ce réglage au hasard d'une variable.
        secure: isProduction || sameSite === 'none',
      },
    },

    plugins: [
      // Connexion par code à 6 chiffres envoyé par email : ni mot de passe, ni SMS à payer.
      emailOTP({
        otpLength: 6,
        expiresIn: 60 * 10,
        allowedAttempts: 3,
        // Première connexion : le compte est créé à la vérification du code.
        disableSignUp: false,
        sendVerificationOTP: async ({ email, otp: code }) => {
          await otp.send(email, code);
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
