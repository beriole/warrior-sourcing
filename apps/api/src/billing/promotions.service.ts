import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  applyPromotion,
  bestPromotion,
  DISCOUNT_KIND_LABELS,
  PROMOTION_TARGET_LABELS,
  priceWithoutPromotion,
  type ApplicablePromotion,
  type DiscountKind,
  type Priced,
  type Promotion,
  type PromotionInput,
  type PromotionTarget,
  type PromotionTrigger,
} from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';

type LignePromotion = {
  id: string;
  name: string;
  description: string | null;
  kind: DiscountKind;
  percentage: number | null;
  amountXaf: number | null;
  target: PromotionTarget;
  targetId: string | null;
  trigger: PromotionTrigger;
  code: string | null;
  startsAt: Date;
  endsAt: Date | null;
  maxRedemptions: number | null;
  maxPerCustomer: number;
  firstPurchaseOnly: boolean;
  minimumAmountXaf: number | null;
  active: boolean;
  createdAt: Date;
  _count: { redemptions: number };
};

/** Ce qu'on cherche à faire remiser : une formation, ou une offre d'abonnement. */
export type SujetPromotion =
  | { kind: 'COURSE'; id: string; theme: string }
  | { kind: 'PLAN'; id: string };

/**
 * Promotions (§43).
 *
 * Un seul moteur pour tout ce qui se vend. Le calcul lui-même vit dans `@ws/contracts`,
 * partagé avec l'écran : le prix annoncé sur une fiche et le prix débité au paiement
 * sortent de la même fonction, donc ils ne peuvent pas différer.
 *
 * Ce service décide **quelles** promotions s'appliquent ; `applyPromotion` décide
 * **combien** elles retirent. Séparer les deux permet de tester le calcul sans base.
 */
@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pourquoi une promotion ne s'applique pas en ce moment, `null` si elle s'applique. */
  private raisonInactive(row: LignePromotion, maintenant = new Date()): string | null {
    if (!row.active) return 'Désactivée.';
    if (row.startsAt > maintenant) return 'Pas encore commencée.';
    if (row.endsAt && row.endsAt <= maintenant) return 'Terminée.';
    if (row.maxRedemptions !== null && row._count.redemptions >= row.maxRedemptions) {
      return 'Quota d’utilisations atteint.';
    }
    return null;
  }

  private format(row: LignePromotion, targetName: string | null): Promotion {
    const inactiveReason = this.raisonInactive(row);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      kind: row.kind,
      kindLabel: DISCOUNT_KIND_LABELS[row.kind].label,
      percentage: row.percentage,
      amountXaf: row.amountXaf,
      target: row.target,
      targetLabel: PROMOTION_TARGET_LABELS[row.target],
      targetId: row.targetId,
      targetName,
      trigger: row.trigger,
      code: row.code,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      maxRedemptions: row.maxRedemptions,
      maxPerCustomer: row.maxPerCustomer,
      firstPurchaseOnly: row.firstPurchaseOnly,
      minimumAmountXaf: row.minimumAmountXaf,
      active: row.active,
      redemptionCount: row._count.redemptions,
      live: inactiveReason === null,
      inactiveReason,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Forme réduite attendue par le calcul partagé. */
  private pourCalcul(row: LignePromotion): ApplicablePromotion {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      percentage: row.percentage,
      amountXaf: row.amountXaf,
      code: row.code,
      endsAt: row.endsAt?.toISOString() ?? null,
      maxRedemptions: row.maxRedemptions,
      redemptionCount: row._count.redemptions,
      minimumAmountXaf: row.minimumAmountXaf,
    };
  }

  /** Portées qui peuvent concerner un sujet donné. */
  private portees(sujet: SujetPromotion): { target: PromotionTarget; targetId: string | null }[] {
    if (sujet.kind === 'COURSE') {
      return [
        { target: 'COURSE', targetId: sujet.id },
        { target: 'COURSE_THEME', targetId: sujet.theme },
        { target: 'ALL_COURSES', targetId: null },
      ];
    }
    return [
      { target: 'PLAN', targetId: sujet.id },
      { target: 'ALL_PLANS', targetId: null },
    ];
  }

  /**
   * Promotions réellement applicables à un sujet, pour un compte donné.
   *
   * Les promotions sur code ne sont retenues que si le code a été saisi : une remise qui
   * s'appliquerait sans qu'on la demande n'aurait pas besoin de code.
   */
  private async candidates(
    sujet: SujetPromotion,
    userId: string | null,
    code: string | null,
  ): Promise<LignePromotion[]> {
    const maintenant = new Date();
    const portees = this.portees(sujet);

    const rows = (await this.prisma.promotion.findMany({
      where: {
        active: true,
        startsAt: { lte: maintenant },
        OR: portees.map((portee) => ({ target: portee.target, targetId: portee.targetId })),
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: maintenant } }] }],
      },
      include: { _count: { select: { redemptions: true } } },
    })) as unknown as LignePromotion[];

    const retenues: LignePromotion[] = [];
    for (const row of rows) {
      if (this.raisonInactive(row, maintenant) !== null) continue;
      // Sur code : seulement si le client l'a saisi, à la casse près.
      if (row.trigger === 'CODE' && row.code !== (code?.trim().toUpperCase() ?? null)) continue;
      if (userId && !(await this.autoriseePour(row, userId))) continue;
      retenues.push(row);
    }
    return retenues;
  }

  /** Conditions liées au compte : quota personnel et réservation au premier achat. */
  private async autoriseePour(row: LignePromotion, userId: string): Promise<boolean> {
    const dejaUtilisee = await this.prisma.promotionRedemption.count({
      where: { promotionId: row.id, userId },
    });
    if (dejaUtilisee >= row.maxPerCustomer) return false;

    if (row.firstPurchaseOnly) {
      // Premier achat : aucune commande payée, aucune prestation payée, aucun abonnement.
      const [commandes, prestations, abonnements] = await Promise.all([
        this.prisma.order.count({ where: { userId, paidAt: { not: null } } }),
        this.prisma.serviceOrder.count({ where: { userId, paidAt: { not: null } } }),
        this.prisma.subscription.count({ where: { userId, status: { not: 'PENDING_PAYMENT' } } }),
      ]);
      if (commandes + prestations + abonnements > 0) return false;
    }

    return true;
  }

  /**
   * Prix affiché pour un sujet. C'est le seul point d'entrée des écrans publics :
   * personne ne recompose un prix ailleurs.
   */
  async priceFor(
    originalXaf: number,
    sujet: SujetPromotion,
    userId: string | null = null,
    code: string | null = null,
  ): Promise<Priced> {
    if (originalXaf <= 0) return priceWithoutPromotion(originalXaf);

    const candidates = await this.candidates(sujet, userId, code);
    const meilleure = bestPromotion(
      originalXaf,
      candidates.map((row) => this.pourCalcul(row)),
    );
    return applyPromotion(originalXaf, meilleure);
  }

  /**
   * Prix remisés d'un lot de formations, en trois requêtes quelles que soient leur
   * nombre. Une résolution par formation aurait multiplié les allers-retours à chaque
   * affichage du catalogue — c'est précisément l'écran le plus consulté.
   */
  async pricesForCourses(
    courses: { id: string; priceXaf: number; theme: string }[],
    userId: string | null,
  ): Promise<Map<string, Priced>> {
    const resultat = new Map<string, Priced>();
    const payantes = courses.filter((cours) => cours.priceXaf > 0);
    for (const cours of courses) resultat.set(cours.id, priceWithoutPromotion(cours.priceXaf));
    if (payantes.length === 0) return resultat;

    const maintenant = new Date();
    const rows = (await this.prisma.promotion.findMany({
      where: {
        active: true,
        trigger: 'AUTOMATIC',
        startsAt: { lte: maintenant },
        target: { in: ['COURSE', 'COURSE_THEME', 'ALL_COURSES'] },
        OR: [{ endsAt: null }, { endsAt: { gt: maintenant } }],
      },
      include: { _count: { select: { redemptions: true } } },
    })) as unknown as LignePromotion[];

    const vivantes = rows.filter((row) => this.raisonInactive(row, maintenant) === null);
    if (vivantes.length === 0) return resultat;

    // Conditions liées au compte, résolues une fois pour toutes les promotions.
    const utilisables = new Set<string>();
    for (const row of vivantes) {
      if (!userId || (await this.autoriseePour(row, userId))) utilisables.add(row.id);
    }

    for (const cours of payantes) {
      const applicables = vivantes.filter(
        (row) =>
          utilisables.has(row.id) &&
          (row.target === 'ALL_COURSES' ||
            (row.target === 'COURSE' && row.targetId === cours.id) ||
            (row.target === 'COURSE_THEME' && row.targetId === cours.theme)),
      );
      const meilleure = bestPromotion(
        cours.priceXaf,
        applicables.map((row) => this.pourCalcul(row)),
      );
      resultat.set(cours.id, applyPromotion(cours.priceXaf, meilleure));
    }

    return resultat;
  }

  /**
   * Enregistre l'utilisation d'une promotion. Appelé au moment où l'achat est confirmé,
   * pas à l'affichage : un prix regardé n'est pas un prix consommé.
   */
  async redeem(promotionId: string, userId: string, subjectId: string | null, discountXaf: number): Promise<void> {
    await this.prisma.promotionRedemption.create({
      data: { promotionId, userId, subjectId, discountXaf },
    });
  }

  // ───────────────────────── Back-office ─────────────────────────

  /** Nom lisible de ce que vise une promotion, quand il peut être résolu. */
  private async nomDeLaCible(target: PromotionTarget, targetId: string | null): Promise<string | null> {
    if (!targetId) return null;
    if (target === 'COURSE') {
      const cours = await this.prisma.course.findUnique({ where: { id: targetId }, select: { title: true } });
      return cours?.title ?? null;
    }
    if (target === 'PLAN') {
      const offre = await this.prisma.subscriptionPlan.findUnique({
        where: { id: targetId },
        select: { name: true },
      });
      return offre?.name ?? null;
    }
    // Un thème est une valeur d'énumération : son libellé vit dans les contrats.
    return targetId;
  }

  async list(): Promise<{ items: Promotion[]; liveCount: number }> {
    const rows = (await this.prisma.promotion.findMany({
      include: { _count: { select: { redemptions: true } } },
      orderBy: [{ active: 'desc' }, { startsAt: 'desc' }],
    })) as unknown as LignePromotion[];

    const items = await Promise.all(
      rows.map(async (row) => this.format(row, await this.nomDeLaCible(row.target, row.targetId))),
    );

    return { items, liveCount: items.filter((item) => item.live).length };
  }

  /** Vérifie que ce que la promotion vise existe réellement, avant de l'enregistrer. */
  private async verifierCible(input: PromotionInput): Promise<void> {
    if (input.target === 'COURSE' && input.targetId) {
      const cours = await this.prisma.course.findUnique({ where: { id: input.targetId } });
      if (!cours) throw new NotFoundException('Cette formation n’existe pas.');
    }
    if (input.target === 'PLAN' && input.targetId) {
      const offre = await this.prisma.subscriptionPlan.findUnique({ where: { id: input.targetId } });
      if (!offre) throw new NotFoundException('Cette offre d’abonnement n’existe pas.');
    }
  }

  private donnees(input: PromotionInput) {
    return {
      name: input.name,
      description: input.description,
      kind: input.kind,
      percentage: input.kind === 'PERCENTAGE' ? input.percentage : null,
      amountXaf: input.kind === 'AMOUNT' || input.kind === 'FIXED_PRICE' ? input.amountXaf : null,
      target: input.target,
      targetId: input.target === 'ALL_COURSES' || input.target === 'ALL_PLANS' ? null : input.targetId,
      trigger: input.trigger,
      code: input.trigger === 'CODE' ? (input.code ?? null) : null,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      maxRedemptions: input.maxRedemptions,
      maxPerCustomer: input.maxPerCustomer,
      firstPurchaseOnly: input.firstPurchaseOnly,
      minimumAmountXaf: input.minimumAmountXaf,
      active: input.active,
    };
  }

  async create(input: PromotionInput): Promise<{ items: Promotion[]; liveCount: number }> {
    await this.verifierCible(input);
    if (input.code) {
      const existant = await this.prisma.promotion.findUnique({ where: { code: input.code } });
      if (existant) {
        throw new BadRequestException('Ce code est déjà utilisé par une autre promotion.');
      }
    }
    await this.prisma.promotion.create({ data: this.donnees(input) });
    return this.list();
  }

  async update(id: string, input: PromotionInput): Promise<{ items: Promotion[]; liveCount: number }> {
    const existant = await this.prisma.promotion.findUnique({ where: { id } });
    if (!existant) throw new NotFoundException('Cette promotion n’existe pas.');
    await this.verifierCible(input);

    if (input.code) {
      const autre = await this.prisma.promotion.findUnique({ where: { code: input.code } });
      if (autre && autre.id !== id) {
        throw new BadRequestException('Ce code est déjà utilisé par une autre promotion.');
      }
    }

    await this.prisma.promotion.update({ where: { id }, data: this.donnees(input) });
    return this.list();
  }

  /**
   * Suppression. Refusée dès qu'une promotion a servi : les remises accordées sont une
   * trace comptable, et l'effacer rendrait les montants passés inexplicables. On la
   * désactive à la place.
   */
  async remove(id: string): Promise<{ items: Promotion[]; liveCount: number }> {
    const row = await this.prisma.promotion.findUnique({
      where: { id },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!row) throw new NotFoundException('Cette promotion n’existe pas.');

    if (row._count.redemptions > 0) {
      throw new BadRequestException(
        `Cette promotion a déjà servi ${row._count.redemptions} fois : désactivez-la plutôt que de la supprimer.`,
      );
    }

    await this.prisma.promotion.delete({ where: { id } });
    return this.list();
  }
}
