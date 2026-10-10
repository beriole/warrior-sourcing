import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { Resend } from 'resend';

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  from: string;
  replyTo?: string;
};

export type TransportResult = {
  /** Nom du transport ayant réellement expédié le message. */
  transport: string;
  /** Identifiant chez le fournisseur, lorsqu'il en fournit un. */
  providerId?: string;
};

export interface EmailTransport {
  readonly name: string;
  send(email: OutgoingEmail): Promise<TransportResult>;
}

/** Envoi réel via Resend. Utilisé dès qu'une clé d'API est configurée. */
export class ResendTransport implements EmailTransport {
  readonly name = 'resend';
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(email: OutgoingEmail): Promise<TransportResult> {
    const { data, error } = await this.client.emails.send({
      from: email.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    });

    if (error) {
      throw new Error(`Resend a refusé l'envoi : ${error.message}`);
    }

    return { transport: this.name, providerId: data?.id };
  }
}

/**
 * Envoi par SMTP, par exemple un compte Gmail avec mot de passe d'application.
 * Sert tant qu'aucun domaine n'est vérifié : pas de configuration DNS, pas de marque.
 */
export class SmtpTransport implements EmailTransport {
  readonly name = 'smtp';
  private readonly mailer: Transporter;

  constructor(options: { host: string; port: number; user: string; password: string }) {
    this.mailer = createTransport({
      host: options.host,
      port: options.port,
      // 465 impose TLS dès la connexion ; les autres ports passent par STARTTLS.
      secure: options.port === 465,
      auth: { user: options.user, pass: options.password },
    });
  }

  async send(email: OutgoingEmail): Promise<TransportResult> {
    const info = await this.mailer.sendMail({
      from: email.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    });

    return { transport: this.name, providerId: info.messageId };
  }
}

/**
 * Repli de développement : au lieu d'envoyer, on écrit le message sur le disque.
 * Permet de travailler sans clé d'API et de relire exactement ce qui serait parti.
 */
export class FileTransport implements EmailTransport {
  readonly name = 'file';
  private readonly logger = new Logger(FileTransport.name);

  constructor(private readonly directory: string) {}

  async send(email: OutgoingEmail): Promise<TransportResult> {
    const dir = resolve(this.directory);
    await mkdir(dir, { recursive: true });

    const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const slug = email.subject
      .normalize('NFD')
      .replaceAll(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .slice(0, 60);
    const file = join(dir, `${stamp}--${slug}.html`);

    await writeFile(file, email.html, 'utf8');
    await writeFile(file.replace(/\.html$/, '.txt'), `À : ${email.to}\nObjet : ${email.subject}\n\n${email.text}`, 'utf8');

    this.logger.log(`Email non envoyé (aucune clé Resend). Écrit dans ${file}`);
    return { transport: this.name, providerId: undefined };
  }
}
