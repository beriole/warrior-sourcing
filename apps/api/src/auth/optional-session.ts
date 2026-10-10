import { Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { Auth } from './auth.config.js';
import { AUTH } from './auth.tokens.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PersonalizationProfile } from '../catalog/personalization.js';

/**
 * Lecture d'une session **si elle existe**, sans jamais l'exiger.
 *
 * Plusieurs écrans sont consultables sans compte — le catalogue, les offres d'abonnement,
 * les prestations — mais s'enrichissent quand une session est là : classement « pour
 * vous », prix remisé réservé à un compte. Les routes qui exigent un droit, elles,
 * passent par `AuthGuard` : ce helper ne protège rien, il renseigne.
 *
 * Le catalogue est consultable sans compte : c'est la vitrine du service.
 * Seul le classement « Pour vous » change quand une session existe, et il ne révèle
 * aucune donnée réservée. On lit donc la session si elle est là, sans jamais l'exiger
 * (les routes qui exigent des droits, elles, passent par AuthGuard).
 */
@Injectable()
export class OptionalSession {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly prisma: PrismaService,
  ) {}

  /** Identifiant du visiteur connecté, ou `null`. */
  async userId(request: Request): Promise<string | null> {
    const session = await this.auth.api
      .getSession({ headers: fromNodeHeaders(request.headers) })
      // Un ennui d'authentification ne doit pas rendre une page publique indisponible.
      .catch(() => null);
    return session?.user.id ?? null;
  }

  /** Profil d'importateur du visiteur connecté, ou `null` s'il n'y a ni session ni profil. */
  async importerProfile(request: Request): Promise<PersonalizationProfile | null> {
    const session = await this.auth.api
      .getSession({ headers: fromNodeHeaders(request.headers) })
      // Un ennui d'authentification ne doit pas empêcher de consulter le catalogue.
      .catch(() => null);
    if (!session) return null;

    const profile = await this.prisma.importerProfile.findUnique({
      where: { userId: session.user.id },
      select: { budgetRange: true, interests: true },
    });
    if (!profile) return null;

    return { budgetRange: profile.budgetRange, interests: profile.interests };
  }
}
