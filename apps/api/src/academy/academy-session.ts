import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { Auth } from '../auth/auth.config.js';
import { AUTH } from '../auth/auth.tokens.js';
import { SubscriptionsService } from '../billing/subscriptions.service.js';

/** Ce que l'Academy a besoin de savoir du visiteur : qui il est, s'il y a quelqu'un. */
export interface AcademyVisitor {
  id: string;
  name: string;
  email: string;
  /**
   * Droit `ACADEMY_INCLUDED` porté par l'abonnement **en cours**, relu à chaque requête.
   *
   * Il est transporté ici plutôt que relu à chaque vérification d'accès : une page de
   * catalogue vérifie le droit pour chaque formation affichée, et relire l'abonnement
   * quarante-huit fois pour une seule page serait absurde. Il n'est jamais mis en cache
   * au-delà de la requête : un abonnement expiré referme la porte dès la suivante.
   */
  academyIncluded: boolean;
}

/**
 * Le catalogue de l'Academy est consultable sans compte : c'est la vitrine des formations.
 * On lit donc la session quand elle existe, sans jamais l'exiger. Les routes qui touchent à
 * une progression, à une note ou à une URL de lecture passent, elles, par `AuthGuard`.
 */
@Injectable()
export class AcademySession {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /** Visiteur connecté, ou `null`. Un ennui d'authentification ne ferme pas la vitrine. */
  async visitor(request: Request): Promise<AcademyVisitor | null> {
    const session = await this.auth.api
      .getSession({ headers: fromNodeHeaders(request.headers) })
      .catch(() => null);
    if (!session) return null;

    const { id, name, email } = session.user;
    // `hasRight` recalcule les droits depuis l'abonnement en cours : rien n'est lu sur
    // le compte, où un droit figé survivrait à l'expiration.
    const academyIncluded = await this.subscriptions
      .hasRight(id, 'ACADEMY_INCLUDED')
      // Un ennui de facturation ne doit pas ouvrir un accès par accident : on referme.
      .catch(() => false);

    return { id, name, email, academyIncluded };
  }

  /**
   * Visiteur connecté, exigé.
   *
   * Les routes qui l'appellent sont déjà derrière `AuthGuard` ; ce qu'elles gagnent ici
   * c'est le **droit d'abonnement**, que `request.user` ne porte pas. Passer `request.user`
   * tel quel revenait à décider d'un accès avec un droit supposé absent, ce qui fermait
   * une formation incluse à quelqu'un qui l'avait payée.
   */
  async member(request: Request): Promise<AcademyVisitor> {
    const visiteur = await this.visitor(request);
    if (!visiteur) throw new UnauthorizedException('Connectez-vous pour continuer.');
    return visiteur;
  }
}
