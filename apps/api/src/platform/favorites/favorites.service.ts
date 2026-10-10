import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FAVORITE_TARGET_TYPES,
  FAVORITE_TARGET_TYPE_LABELS,
  type AddFavoriteRequest,
  type Favorite,
  type FavoriteListResponse,
  type FavoriteMutationResponse,
  type FavoriteQuery,
  type FavoriteTargetType,
} from '@ws/contracts';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SearchService } from '../search/search.service.js';

/** Ce qu'une fiche expose à la liste des favoris, quelle que soit sa famille. */
type Cible = { id: string; slug: string; title: string; subtitle: string | null };

/**
 * Favoris (PLAT-09, §36).
 *
 * Deux décisions portent ce service :
 *
 * 1. **Les deux routes sont idempotentes.** Mettre en favori ce qui l'est déjà, ou retirer
 *    ce qui ne l'est pas, répond 200 avec l'état courant. Sur un bouton qu'on tapote deux
 *    fois au doigt, une erreur serait un faux problème.
 * 2. **Une cible disparue n'est pas une erreur.** Un produit retiré du catalogue reste
 *    référencé par le favori ; on l'omet de la liste au lieu de faire échouer la page. La
 *    ligne orpheline est nettoyée au passage, sans bruit.
 */
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Charge les fiches d'une famille, par identifiant. Les absentes ne sont pas renvoyées. */
  private async cibles(type: FavoriteTargetType, ids: string[]): Promise<Map<string, Cible>> {
    if (ids.length === 0) return new Map();

    const lignes: Cible[] = await (async () => {
      switch (type) {
        case 'PRODUCT': {
          const rows = await this.prisma.product.findMany({
            where: { id: { in: ids } },
            select: { id: true, slug: true, name: true, description: true },
          });
          return rows.map((row) => ({ id: row.id, slug: row.slug, title: row.name, subtitle: row.description }));
        }
        case 'SUPPLIER': {
          const rows = await this.prisma.supplier.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, publicSummary: true },
          });
          // Pas d'identifiant d'URL côté fournisseur : l'identifiant technique en tient lieu.
          return rows.map((row) => ({ id: row.id, slug: row.id, title: row.name, subtitle: row.publicSummary }));
        }
        case 'COURSE': {
          const rows = await this.prisma.course.findMany({
            where: { id: { in: ids } },
            select: { id: true, slug: true, title: true, summary: true },
          });
          return rows.map((row) => ({ id: row.id, slug: row.slug, title: row.title, subtitle: row.summary }));
        }
        case 'SERVICE': {
          const rows = await this.prisma.serviceOffering.findMany({
            where: { id: { in: ids } },
            select: { id: true, slug: true, name: true, summary: true },
          });
          return rows.map((row) => ({ id: row.id, slug: row.slug, title: row.name, subtitle: row.summary }));
        }
      }
    })();

    return new Map(lignes.map((ligne) => [ligne.id, ligne]));
  }

  /** Vrai quand la fiche visée existe vraiment : on ne met pas en favori un identifiant inventé. */
  private async existe(type: FavoriteTargetType, id: string): Promise<boolean> {
    return (await this.cibles(type, [id])).has(id);
  }

  async list(userId: string, query: FavoriteQuery): Promise<FavoriteListResponse> {
    const where = { userId, ...(query.type ? { targetType: query.type } : {}) };

    const [lignes, total, groupes] = await Promise.all([
      this.prisma.favorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.favorite.count({ where }),
      this.prisma.favorite.groupBy({ by: ['targetType'], where: { userId }, _count: { _all: true } }),
    ]);

    // Une seule requête par famille, quel que soit le nombre de favoris affichés.
    const parFamille = new Map<FavoriteTargetType, string[]>();
    for (const ligne of lignes) {
      const type = ligne.targetType as FavoriteTargetType;
      parFamille.set(type, [...(parFamille.get(type) ?? []), ligne.targetId]);
    }
    const fiches = new Map<FavoriteTargetType, Map<string, Cible>>();
    for (const [type, ids] of parFamille) fiches.set(type, await this.cibles(type, ids));

    const items: Favorite[] = [];
    const orphelins: string[] = [];
    for (const ligne of lignes) {
      const type = ligne.targetType as FavoriteTargetType;
      const cible = fiches.get(type)?.get(ligne.targetId);
      if (!cible) {
        orphelins.push(ligne.id);
        continue;
      }
      items.push({
        targetType: type,
        targetTypeLabel: FAVORITE_TARGET_TYPE_LABELS[type].label,
        targetId: ligne.targetId,
        slug: cible.slug,
        title: cible.title,
        subtitle: cible.subtitle,
        href: SearchService.href(type, cible.slug),
        addedAt: ligne.createdAt.toISOString(),
      });
    }

    // Nettoyage silencieux : la fiche n'existe plus, le favori n'a plus d'objet.
    if (orphelins.length > 0) {
      await this.prisma.favorite.deleteMany({ where: { id: { in: orphelins } } });
    }

    return {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      items,
      counts: FAVORITE_TARGET_TYPES.map((type) => ({
        type,
        label: FAVORITE_TARGET_TYPE_LABELS[type].plural,
        count: groupes.find((groupe) => groupe.targetType === type)?._count._all ?? 0,
      })).filter((compte) => compte.count > 0),
    };
  }

  async add(userId: string, input: AddFavoriteRequest): Promise<FavoriteMutationResponse> {
    if (!(await this.existe(input.targetType, input.targetId))) {
      throw new NotFoundException('Cette fiche n’existe pas.');
    }

    const avant = await this.prisma.favorite.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      },
    });

    if (!avant) {
      await this.prisma.favorite.create({
        data: { userId, targetType: input.targetType, targetId: input.targetId },
      });
    }

    return {
      targetType: input.targetType,
      targetId: input.targetId,
      favorite: true,
      changed: avant === null,
      total: await this.prisma.favorite.count({ where: { userId } }),
    };
  }

  async remove(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<FavoriteMutationResponse> {
    const { count } = await this.prisma.favorite.deleteMany({ where: { userId, targetType, targetId } });

    return {
      targetType,
      targetId,
      favorite: false,
      changed: count > 0,
      total: await this.prisma.favorite.count({ where: { userId } }),
    };
  }
}
