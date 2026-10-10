import { Injectable } from '@nestjs/common';
import {
  SUBSCRIPTION_RIGHT_LABELS,
  SUPPLIER_VERIFICATION_LABELS,
  SUPPLIER_VERIFICATION_LEVELS,
  type AssistantRequest,
  type AssistantResponse,
  type AssistantStatusResponse,
  type SubscriptionRight,
} from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { OpenRouterGateway } from './openrouter.gateway.js';

/**
 * Assistant contextuel (AI-01, §30).
 *
 * Le modèle ne lit pas la base : le serveur relève les faits et les lui transmet. La
 * différence est tout sauf cosmétique — c'est elle qui permet d'exiger qu'aucun chiffre
 * ne sorte d'ailleurs que de ce bloc, et de le vérifier.
 *
 * Ce que l'assistant ne fait **jamais**, quelles que soient les questions :
 * - donner une adresse d'entrepôt, un code client ou des coordonnées de fournisseur :
 *   ces informations ont leurs écrans, qui vérifient les droits ;
 * - chiffrer un coût rendu, un fret ou des droits de douane : ces montants viennent du
 *   calculateur et des grilles saisies, et l'assistant y renvoie.
 */
@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OpenRouterGateway,
  ) {}

  status(): AssistantStatusResponse {
    return {
      disponible: this.gateway.disponible,
      modele: this.gateway.disponible ? this.gateway.modele : null,
    };
  }

  async repondre(input: AssistantRequest, userId: string | null): Promise<AssistantResponse> {
    const context = await this.faits(userId);

    const reponse = await this.gateway.repondre({
      consigne: consigne(input.page),
      context,
      historique: input.historique,
      question: input.question,
    });

    return { reponse, modele: this.gateway.modele, liens: LIENS };
  }

  /**
   * Les faits que le modèle a le droit d'utiliser, relevés à l'instant de la question.
   *
   * Tout est public ou appartient au compte qui pose la question. Rien de ce bloc ne
   * contourne une vérification de droit : les prix des formations et des offres sont
   * déjà affichés sur les pages publiques, et l'état d'abonnement est celui du
   * demandeur.
   */
  private async faits(userId: string | null): Promise<string> {
    const [formations, offres, prestations, abonnement] = await Promise.all([
      this.prisma.course.findMany({
        where: { publishedAt: { not: null } },
        select: { title: true, access: true, priceXaf: true, level: true, theme: true },
        orderBy: { priceXaf: 'asc' },
        take: 20,
      }),
      this.prisma.subscriptionPlan.findMany({
        where: { active: true },
        select: { name: true, priceXaf: true, rights: true, serviceDiscountPercent: true },
        orderBy: { position: 'asc' },
      }),
      this.prisma.serviceOffering.findMany({
        // Même critère que le catalogue public : non publiée, non servie.
        where: { publishedAt: { not: null } },
        select: { name: true, summary: true },
        orderBy: { position: 'asc' },
        take: 12,
      }),
      userId
        ? this.prisma.subscription.findFirst({
            where: { userId, status: 'ACTIVE', endsAt: { gt: new Date() } },
            select: { endsAt: true, plan: { select: { name: true } } },
            orderBy: { endsAt: 'desc' },
          })
        : null,
    ]);

    const lignes: string[] = [];

    lignes.push('FORMATIONS AU CATALOGUE (titre — accès — prix en FCFA) :');
    for (const cours of formations) {
      const prix =
        cours.access === 'FREE'
          ? 'gratuite'
          : cours.access === 'SUBSCRIPTION'
            ? 'incluse dans l’abonnement'
            : `${cours.priceXaf} FCFA`;
      lignes.push(`- ${cours.title} — ${prix}`);
    }

    lignes.push('', 'OFFRES D’ABONNEMENT (nom — prix mensuel — droits ouverts) :');
    for (const offre of offres) {
      const droits = (offre.rights as SubscriptionRight[])
        .map((droit) => SUBSCRIPTION_RIGHT_LABELS[droit].label)
        .join(', ');
      lignes.push(
        `- ${offre.name} — ${offre.priceXaf === 0 ? 'gratuite' : `${offre.priceXaf} FCFA par mois`}` +
          `${droits ? ` — ${droits}` : ''}` +
          `${offre.serviceDiscountPercent > 0 ? ` — ${offre.serviceDiscountPercent} % de remise sur les prestations` : ''}`,
      );
    }

    if (prestations.length > 0) {
      lignes.push('', 'PRESTATIONS PROPOSÉES :');
      for (const prestation of prestations) lignes.push(`- ${prestation.name} : ${prestation.summary}`);
    }

    lignes.push('', 'NIVEAUX DE VÉRIFICATION DES FOURNISSEURS (ce que chacun signifie) :');
    for (const niveau of SUPPLIER_VERIFICATION_LEVELS) {
      lignes.push(`- ${SUPPLIER_VERIFICATION_LABELS[niveau].label} : ${SUPPLIER_VERIFICATION_LABELS[niveau].meaning}`);
    }

    lignes.push(
      '',
      'COMPTE QUI POSE LA QUESTION :',
      userId
        ? abonnement
          ? `- abonné « ${abonnement.plan.name} », droits ouverts jusqu’au ${abonnement.endsAt.toLocaleDateString('fr-FR')}.`
          : '- connecté, sans abonnement payant en cours.'
        : '- visiteur non connecté.',
    );

    return lignes.join('\n');
  }
}

/** Consigne de tour, qui dépend de la page d'où la question part. */
function consigne(page: string | null): string {
  const base =
    'Réponds à la question en t’appuyant uniquement sur les faits relevés. ' +
    'Si la réponse demande un montant que tu n’as pas, dis-le et renvoie vers le calculateur. ' +
    'Six phrases au maximum.';

  if (!page) return base;
  return `${base}\nLa question est posée depuis la page « ${page} » : tiens-en compte si c’est utile, ignore-la sinon.`;
}

/**
 * Orientations proposées sous chaque réponse.
 *
 * Construites ici, à partir de routes qui existent réellement. Laisser le modèle fabriquer
 * ses liens l'amènerait à inventer des chemins plausibles, et l'utilisateur tomberait sur
 * une page introuvable — en ayant l'impression que c'est le site qui est cassé.
 */
const LIENS: { libelle: string; href: string }[] = [
  { libelle: 'Calculer un coût rendu', href: '/calculateur' },
  { libelle: 'Voir les formations', href: '/academy' },
  { libelle: 'Adresse à donner au fournisseur', href: '/expedition' },
  { libelle: 'Écrire à l’équipe', href: '/messages' },
];
