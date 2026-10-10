import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  COURSE_PURCHASE_STATUS_LABELS,
  type BuyCourseRequest,
  type BuyCourseResponse,
} from '@ws/contracts';
import { AccountProvisioning } from '../auth/account-provisioning.js';
import { AccessActivation } from '../billing/access-activation.service.js';
import { PromotionsService } from '../billing/promotions.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Achat d'une formation à l'unité (SUB-02, §26).
 *
 * Jusqu'ici, une formation pouvait porter un prix que personne ne pouvait payer : seule
 * l'équipe savait ouvrir un accès. Un prix affiché sans moyen de le régler est pire qu'un
 * prix absent — il fait croire à une boutique.
 *
 * Le montant n'est jamais envoyé par le client. Il est repris de la fiche, promotion
 * comprise, par le même moteur que l'abonnement, puis figé sur l'achat : c'est la seule
 * façon d'être sûr que le montant annoncé est celui qui sera débité.
 */
@Injectable()
export class CoursePurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly promotions: PromotionsService,
    private readonly activation: AccessActivation,
    private readonly provisioning: AccountProvisioning,
  ) {}

  /**
   * Achète une formation, avec ou sans compte.
   *
   * Sans session, `fullName` et `email` sont exigés et le compte est créé au passage ; ses
   * identifiants ne sont engendrés qu'à la **confirmation du paiement**. Quand l'adresse
   * appartient déjà à un compte, on s'y rattache sans rien réinitialiser : envoyer un
   * nouveau mot de passe parce qu'un tiers a payé enfermerait le propriétaire dehors.
   */
  async buy(slug: string, input: BuyCourseRequest, sessionUserId: string | null): Promise<BuyCourseResponse> {
    const course = await this.prisma.course.findFirst({
      where: { slug, publishedAt: { not: null } },
      select: { id: true, slug: true, title: true, access: true, priceXaf: true, theme: true },
    });
    if (!course) throw new NotFoundException('Cette formation n’existe pas.');

    if (course.access !== 'PAID') {
      throw new BadRequestException({
        message:
          course.access === 'FREE'
            ? 'Cette formation est gratuite : il n’y a rien à acheter.'
            : 'Cette formation est incluse dans l’abonnement : souscrivez une offre pour l’ouvrir.',
        code: 'course_not_purchasable',
      });
    }

    const { user, created } = await this.resoudreCompte(input, sessionUserId);

    const dejaInscrit = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
      select: { id: true },
    });
    if (dejaInscrit) {
      throw new ConflictException({
        message: 'Cette formation vous est déjà ouverte.',
        code: 'course_already_owned',
      });
    }

    // Un achat laissé en attente ne bloque pas : on le reprend au lieu d'en empiler un
    // second, sinon un client qui hésite finit avec trois lignes pour une formation.
    const enAttente = await this.prisma.coursePurchase.findFirst({
      where: { userId: user.id, courseId: course.id, status: 'PENDING_PAYMENT' },
      orderBy: { createdAt: 'desc' },
    });

    const prix = await this.promotions.priceFor(
      course.priceXaf,
      { kind: 'COURSE', id: course.id, theme: course.theme },
      user.id,
      input.promotionCode,
    );

    const offerte = prix.finalXaf === 0;

    const achat = enAttente
      ? await this.prisma.coursePurchase.update({
          where: { id: enAttente.id },
          data: { paidXaf: prix.finalXaf, status: offerte ? 'PAID' : 'PENDING_PAYMENT' },
        })
      : await this.prisma.coursePurchase.create({
          data: {
            userId: user.id,
            courseId: course.id,
            status: offerte ? 'PAID' : 'PENDING_PAYMENT',
            paidXaf: prix.finalXaf,
            provisionCredentials: created,
          },
        });

    if (prix.promotionId) {
      await this.promotions.redeem(prix.promotionId, user.id, course.id, prix.discountXaf);
    }

    if (offerte) {
      // Rendue gratuite par une promotion : rien à encaisser, l'accès s'ouvre tout de suite.
      await this.activation.activateCoursePurchase(achat.id, { dejaPaye: true });
      return this.reponse({ achat, course, email: user.email, created, paymentReference: null, phone: input.payerPhone });
    }

    const paiement = await this.payments.initiateForOrder({
      coursePurchaseId: achat.id,
      user,
      amountXaf: prix.finalXaf,
      method: input.paymentMethod,
      payerPhone: input.payerPhone,
      message: `Formation ${course.title}`,
    });

    await this.prisma.coursePurchase.update({
      where: { id: achat.id },
      data: { paymentReference: paiement.reference },
    });

    return this.reponse({
      achat,
      course,
      email: user.email,
      created,
      paymentReference: paiement.reference,
      phone: input.payerPhone,
    });
  }

  /**
   * Compte à qui rattacher l'achat : celui de la session, ou celui que l'adresse désigne,
   * créé si besoin. Les deux champs d'identité sont ignorés quand une session existe — on
   * ne renomme pas un compte parce qu'un formulaire a été rempli autrement.
   */
  private async resoudreCompte(
    input: BuyCourseRequest,
    sessionUserId: string | null,
  ): Promise<{ user: { id: string; name: string; email: string }; created: boolean }> {
    if (sessionUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { id: true, name: true, email: true },
      });
      if (!user) throw new NotFoundException('Ce compte n’existe plus.');
      return { user, created: false };
    }

    if (!input.fullName || !input.email) {
      throw new BadRequestException({
        message: 'Indiquez votre nom et votre adresse électronique, ou connectez-vous.',
        code: 'identity_required',
      });
    }

    return this.provisioning.ensure({ email: input.email, name: input.fullName });
  }

  private reponse(input: {
    achat: { id: string; status: string; paidXaf: number; createdAt: Date };
    course: { slug: string; title: string };
    email: string;
    created: boolean;
    paymentReference: string | null;
    phone: string;
  }): BuyCourseResponse {
    const status = input.achat.status as keyof typeof COURSE_PURCHASE_STATUS_LABELS;

    return {
      purchase: {
        id: input.achat.id,
        courseSlug: input.course.slug,
        courseTitle: input.course.title,
        status,
        statusLabel: COURSE_PURCHASE_STATUS_LABELS[status],
        paidXaf: input.achat.paidXaf,
        createdAt: input.achat.createdAt.toISOString(),
      },
      paymentReference: input.paymentReference,
      email: input.email,
      accountCreated: input.created,
      nextStep: prochaineEtape({
        paiementLance: input.paymentReference !== null,
        compteCree: input.created,
        phone: input.phone,
        titre: input.course.title,
      }),
    };
  }
}

/**
 * Ce qui se passe maintenant, en une phrase. Écrite par le serveur parce qu'elle dépend
 * de ce qui a réellement eu lieu : un compte créé ou non, un paiement lancé ou non.
 */
function prochaineEtape(etat: {
  paiementLance: boolean;
  compteCree: boolean;
  phone: string;
  titre: string;
}): string {
  if (!etat.paiementLance) {
    return etat.compteCree
      ? `« ${etat.titre} » vous est ouverte, et vos identifiants de connexion viennent de partir par courriel.`
      : `« ${etat.titre} » vous est ouverte.`;
  }

  const validation = `Une demande de paiement a été envoyée au ${etat.phone}. Validez-la sur votre téléphone avec votre code secret.`;
  return etat.compteCree
    ? `${validation} Vos identifiants de connexion partiront par courriel dès la confirmation.`
    : `${validation} La formation s’ouvrira dès la confirmation.`;
}
