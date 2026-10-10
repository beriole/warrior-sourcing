import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service.js';

/**
 * Envoi du code de connexion.
 *
 * Le canal est l'email : pas de fournisseur SMS à payer, et l'adresse récoltée sert
 * ensuite aux confirmations de commande et au suivi logistique.
 */
export abstract class OtpSender {
  abstract send(email: string, code: string): Promise<void>;
}

@Injectable()
export class EmailOtpSender extends OtpSender {
  private readonly logger = new Logger('OTP');

  constructor(private readonly mail: MailService) {
    super();
  }

  async send(email: string, code: string): Promise<void> {
    try {
      await this.mail.send({
        to: email,
        template: 'account-verification',
        data: { code, expiresInMinutes: 10 },
      });
    } catch (error) {
      // Sans envoi possible, le code reste lisible dans les logs du serveur : le
      // développement continue, mais la trace dit clairement que rien n'est parti.
      this.logger.error(`Code non envoyé à ${email} : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
      this.logger.warn(`Code de connexion pour ${email} : ${code}`);
    }
  }
}
