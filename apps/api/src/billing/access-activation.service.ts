import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SUBSCRIPTION_RIGHT_LABELS, type SubscriptionRight } from '@ws/contracts';
import { AccountProvisioning } from '../auth/account-provisioning.js';
import type { Env } from '../config/env.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Ouverture effective d'un accès payé, et envoi de ses identifiants (§43, §26).
 *
 * Deux produits se vendent : l'abonnement et la formation à l'unité. Trois chemins mènent
 * ici — la confirmation de paiement (lot PAY), et l'activation immédiate d'une offre ou
 * d'une formation rendue gratuite par une promotion — et un seul code les sert. Plusieurs
 * copies de cette logique finiraient par diverger, et la divergence porterait sur l'envoi
 * d'un mot de passe, donc sur un accès.
 *
 * Volontairement sans dépendance ni vers le lot PAY ni vers le reste du lot SUB : c'est ce
 * qui permet aux deux de l'appeler sans boucle de modules.
 */
@Injectable()
export class AccessActivation {
  private readonly logger = new Logger(AccessActivation.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly provisioning: AccountProvisioning,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Fait basculer l'abonnement à « actif » puis prévient le client.
   *
   * Idempotent de bout en bout :
   * - le passage à ACTIVE ne mord que sur un abonnement encore en attente, donc un
   *   webhook rejoué n'étend pas la période une seconde fois ;
   * - `credentialsSentAt` est réservé avant d'engendrer le mot de passe, donc deux
   *   confirmations concurrentes ne peuvent pas en fabriquer deux — le second
   *   invaliderait le premier, déjà parti par courriel.
   *
   * @param dejaActif vrai quand l'appelant vient de créer l'abonnement directement
   *   actif (offre gratuite) : il n'y a alors aucune transition à écrire.
   */
  async activateSubscription(subscriptionId: string, options: { dejaActif?: boolean } = {}): Promise<void> {
    if (!options.dejaActif) {
      const { count } = await this.prisma.subscription.updateMany({
        where: { id: subscriptionId, status: 'PENDING_PAYMENT' },
        data: { status: 'ACTIVE' },
      });
      if (count === 0) return;
    }

    const abonnement = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: { select: { name: true, rights: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!abonnement) return;

    const motDePasse = await this.issueCredentialsIfDue({
      reserver: () =>
        this.prisma.subscription.updateMany({
          where: { id: abonnement.id, credentialsSentAt: null },
          data: { credentialsSentAt: new Date() },
        }),
      userId: abonnement.userId,
      provisionCredentials: abonnement.provisionCredentials,
      dejaEnvoye: abonnement.credentialsSentAt !== null,
    });

    await this.envoyer(subscriptionId, {
      to: abonnement.user.email,
      userId: abonnement.userId,
      template: 'subscription-activated',
      data: {
        firstName: prenom(abonnement.user.name),
        planName: abonnement.plan.name,
        amount: { amountMinor: abonnement.paidXaf, currency: 'XAF' },
        endsAt: abonnement.endsAt,
        email: abonnement.user.email,
        password: motDePasse,
        rights: (abonnement.plan.rights as SubscriptionRight[]).map(
          (droit) => SUBSCRIPTION_RIGHT_LABELS[droit].label,
        ),
        loginUrl: `${this.appUrl()}/connexion`,
      },
    });
  }

  /**
   * Ouverture d'une formation achetée à l'unité (SUB-02).
   *
   * L'achat et l'inscription sont deux écritures distinctes et le restent : l'achat dit
   * ce qui a été payé, l'inscription dit ce qui est ouvert. `upsert` sur l'inscription
   * plutôt que `create` — un compte peut déjà avoir reçu l'accès par l'équipe avant de
   * payer, et l'achat ne doit pas échouer pour autant.
   */
  async activateCoursePurchase(purchaseId: string, options: { dejaPaye?: boolean } = {}): Promise<void> {
    if (!options.dejaPaye) {
      const { count } = await this.prisma.coursePurchase.updateMany({
        where: { id: purchaseId, status: 'PENDING_PAYMENT' },
        data: { status: 'PAID' },
      });
      if (count === 0) return;
    }

    const achat = await this.prisma.coursePurchase.findUnique({
      where: { id: purchaseId },
      include: {
        course: { select: { id: true, slug: true, title: true, lessons: { select: { id: true } } } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!achat) return;

    await this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId: achat.userId, courseId: achat.courseId } },
      create: { userId: achat.userId, courseId: achat.courseId, source: 'PURCHASE' },
      update: {},
    });

    const motDePasse = await this.issueCredentialsIfDue({
      reserver: () =>
        this.prisma.coursePurchase.updateMany({
          where: { id: achat.id, credentialsSentAt: null },
          data: { credentialsSentAt: new Date() },
        }),
      userId: achat.userId,
      provisionCredentials: achat.provisionCredentials,
      dejaEnvoye: achat.credentialsSentAt !== null,
    });

    await this.envoyer(purchaseId, {
      to: achat.user.email,
      userId: achat.userId,
      template: 'course-access-granted',
      data: {
        firstName: prenom(achat.user.name),
        courseTitle: achat.course.title,
        amount: { amountMinor: achat.paidXaf, currency: 'XAF' },
        lessonCount: achat.course.lessons.length,
        email: achat.user.email,
        password: motDePasse,
        courseUrl: `${this.appUrl()}/academy/${achat.course.slug}`,
        loginUrl: `${this.appUrl()}/connexion`,
      },
    });
  }

  private appUrl(): string {
    return this.config.get('APP_URL', { infer: true });
  }

  /**
   * L'accès est ouvert : on ne le referme pas parce qu'un courriel n'est pas parti. Le
   * compte reste joignable par code à six chiffres, qui ne dépend pas de ce mot de passe.
   * La trace doit rester bruyante, car le client, lui, attend un email.
   */
  private async envoyer(
    reference: string,
    envoi: Parameters<MailService['send']>[0],
  ): Promise<void> {
    try {
      await this.mail.send(envoi);
    } catch (error) {
      this.logger.error(
        `Accès ${reference} ouvert, mais l’email « ${envoi.template} » n’est pas parti : ${describeError(error)}`,
      );
    }
  }

  /**
   * Mot de passe engendré pour ce compte, ou chaîne vide quand il n'y a rien à engendrer :
   * compte déjà existant, ou identifiants déjà envoyés pour cet achat.
   *
   * La réservation passe avant la fabrication : si deux confirmations arrivent en même
   * temps, une seule remporte la réservation, et il ne part qu'un seul mot de passe.
   */
  private async issueCredentialsIfDue(input: {
    reserver: () => Promise<{ count: number }>;
    userId: string;
    provisionCredentials: boolean;
    dejaEnvoye: boolean;
  }): Promise<string> {
    if (!input.provisionCredentials || input.dejaEnvoye) return '';

    const { count } = await input.reserver();
    if (count === 0) return '';

    return this.provisioning.issuePassword(input.userId);
  }
}

function prenom(nomComplet: string): string {
  return nomComplet.split(' ')[0] ?? '';
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
