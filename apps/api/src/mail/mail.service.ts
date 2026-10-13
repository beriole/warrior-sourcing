import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_KEYS, getEmail, renderEmail, type EmailKey } from '@ws/emails';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  FileTransport,
  ResendTransport,
  SmtpTransport,
  type EmailTransport,
  type OutgoingEmail,
} from './transports.js';

export type SendEmailInput = {
  to: string;
  template: EmailKey;
  /** Données du template. Les champs manquants prennent leur valeur par défaut. */
  data?: unknown;
  /** Utilisateur concerné, pour retrouver ses emails depuis le back-office. */
  userId?: string;
};

export type SendEmailResult = {
  id: string;
  subject: string;
  transport: string;
  providerId?: string;
};

/**
 * Point d'entrée unique des notifications email.
 *
 * Ajouter un type d'email ne demande aucune modification ici : il suffit de déclarer
 * le template dans @ws/emails, puis d'appeler `send({ template: 'ma-cle', data })`.
 * Chaque envoi, réussi ou non, laisse une trace dans la table email_log.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: EmailTransport;
  /** Moyen d'envoi retenu, exposé par /v1/health. */
  readonly moyen: 'resend' | 'smtp' | 'fichier';

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    this.transport = this.pickTransport();
    this.moyen =
      this.transport instanceof ResendTransport
        ? 'resend'
        : this.transport instanceof SmtpTransport
          ? 'smtp'
          : 'fichier';
  }

  /**
   * Ordre de préférence : Resend si une clé existe, sinon SMTP si le compte est configuré,
   * sinon écriture sur disque pour continuer à travailler sans rien envoyer.
   */
  private pickTransport(): EmailTransport {
    const get = <K extends keyof Env>(key: K) => this.config.get(key, { infer: true });

    const apiKey = get('RESEND_API_KEY');
    if (apiKey) return new ResendTransport(apiKey);

    const host = get('SMTP_HOST');
    const user = get('SMTP_USER') ?? get('EMAIL');
    const password = get('PASS_EMAIL') ?? get('EMAIL_PASSWORD');

    if (host && user && password) {
      this.logger.log(`Envoi des emails par SMTP via ${host} (compte ${user}).`);
      return new SmtpTransport({ host, port: get('SMTP_PORT'), user, password });
    }

    this.logger.warn('Aucun moyen d’envoi configuré : les emails sont écrits sur le disque.');
    return new FileTransport(get('MAIL_OUTBOX_DIR'));
  }

  /** Clés disponibles, utile au back-office et aux tests. */
  listTemplates() {
    return EMAIL_KEYS.map((key) => ({
      key,
      name: getEmail(key).name,
      category: getEmail(key).category,
      description: getEmail(key).description,
      fixtures: Object.keys(getEmail(key).fixtures),
    }));
  }

  /** Rend un email sans l'envoyer : prévisualisation et tests. */
  async render(template: EmailKey, data?: unknown) {
    return renderEmail(template, this.withBrand(data));
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const { subject, html, text } = await renderEmail(input.template, this.withBrand(input.data));

    const email: OutgoingEmail = {
      to: input.to,
      from: this.config.get('MAIL_FROM', { infer: true }),
      subject,
      html,
      text,
      replyTo: this.config.get('MAIL_REPLY_TO', { infer: true }),
    };

    try {
      const result = await this.transport.send(email);

      const log = await this.prisma.emailLog.create({
        data: {
          recipient: input.to,
          template: input.template,
          subject,
          status: 'SENT',
          transport: result.transport,
          providerId: result.providerId,
          userId: input.userId,
        },
      });

      this.logger.log(`Email « ${subject} » envoyé à ${input.to} via ${result.transport}`);
      return { id: log.id, subject, transport: result.transport, providerId: result.providerId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';

      await this.prisma.emailLog.create({
        data: {
          recipient: input.to,
          template: input.template,
          subject,
          status: 'FAILED',
          transport: this.transport.name,
          error: message,
          userId: input.userId,
        },
      });

      this.logger.error(`Échec de l'envoi à ${input.to} : ${message}`);
      throw error;
    }
  }

  /**
   * Complète les données avec les liens de la plateforme.
   * Un appelant peut toujours les remplacer explicitement.
   */
  private withBrand(data: unknown): unknown {
    const appUrl = this.config.get('APP_URL', { infer: true });
    const base = {
      brand: {
        appUrl,
        preferencesUrl: `${appUrl}/profil/notifications`,
        supportEmail: this.config.get('MAIL_SUPPORT_ADDRESS', { infer: true }),
      },
    };

    if (data && typeof data === 'object') {
      return { ...base, ...(data as Record<string, unknown>) };
    }
    return base;
  }
}
