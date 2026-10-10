import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  INTEREST_CATEGORY_LABELS,
  PRODUCT_STATUS_LABELS,
  type AdminProductDetailResponse,
  type AdminProductListResponse,
  type AdminProductMarket,
  type AdminProductResponse,
  type AdminProductSearchQuery,
  type CreateProductRequest,
  type ProductStatus,
  type UpdateProductMarketRequest,
  type UpdateProductRequest,
  type UpdateProductStatusRequest,
} from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';

/** Identifiant d'URL dérivé du nom. Suffixé si un autre produit porte déjà le même. */
function slugifier(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

type LigneProduit = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: keyof typeof INTEREST_CATEGORY_LABELS;
  status: ProductStatus;
  purchasePriceMinor: number;
  purchaseCurrency: 'XAF' | 'CNY' | 'USD' | 'EUR';
  purchasePriceXaf: number;
  exchangeRate: unknown;
  exchangeRateAt: Date;
  exchangeRateSource: string;
  moq: number;
  weightGrams: number;
  volumeCm3: number | null;
  badges: AdminProductResponse['badges'];
  watchPoints: string[];
  supplierIds: string[];
  publishedAt: Date | null;
  updatedAt: Date;
  _count: { images: number };
};

/**
 * Gestion des produits du catalogue (ADM-03, §12, §13).
 *
 * Deux règles portent tout ce service :
 *
 * 1. **La publication se mérite.** Une fiche publiée est lue par des gens qui vont engager
 *    de l'argent dessus. Le serveur vérifie donc, avant de publier, que les informations
 *    qui fondent une décision d'achat sont là — et il dit précisément lesquelles manquent,
 *    plutôt que de refuser sans expliquer.
 * 2. **Tout changement d'état est journalisé.** Publier, retirer, modifier un relevé de
 *    marché : chaque action laisse une ligne d'audit avec son auteur et son motif.
 */
@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Ce qui manque pour qu'une fiche soit publiable.
   * La liste est renvoyée telle quelle à l'interface : une seule définition de la règle.
   */
  private manquePourPublier(row: LigneProduit): string[] {
    const manques: string[] = [];
    if (row.description.trim().length < 20) manques.push('Une description d’au moins 20 caractères');
    if (row.purchasePriceXaf <= 0) manques.push('Un prix d’achat converti en FCFA');
    if (row.moq <= 0) manques.push('Une quantité minimum de commande');
    if (row.weightGrams <= 0) manques.push('Un poids unitaire, indispensable au calcul du fret');
    if (row._count.images === 0) manques.push('Au moins une image du produit');
    if (row.watchPoints.length === 0) manques.push('Au moins un point de vigilance (§13)');
    return manques;
  }

  private format(row: LigneProduit): AdminProductResponse {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      category: row.category,
      categoryLabel: INTEREST_CATEGORY_LABELS[row.category],
      status: row.status,
      statusLabel: PRODUCT_STATUS_LABELS[row.status].label,
      purchasePriceMinor: row.purchasePriceMinor,
      purchaseCurrency: row.purchaseCurrency,
      purchasePriceXaf: row.purchasePriceXaf,
      exchangeRate: Number(row.exchangeRate),
      exchangeRateAt: row.exchangeRateAt.toISOString(),
      exchangeRateSource: row.exchangeRateSource,
      moq: row.moq,
      weightGrams: row.weightGrams,
      volumeCm3: row.volumeCm3,
      badges: row.badges,
      watchPoints: row.watchPoints,
      supplierIds: row.supplierIds,
      imageCount: row._count.images,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      missingForPublication: this.manquePourPublier(row),
    };
  }

  private static readonly SELECTION = {
    include: { _count: { select: { images: true } } },
  } as const;

  async list(query: AdminProductSearchQuery): Promise<AdminProductListResponse> {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.recherche
        ? {
            OR: [
              { name: { contains: query.recherche, mode: 'insensitive' as const } },
              { slug: { contains: query.recherche, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total, groupes] = await Promise.all([
      this.prisma.product.findMany({
        where,
        ...AdminProductsService.SELECTION,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.product.count({ where }),
      this.prisma.product.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    return {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      items: rows.map((row) => this.format(row as unknown as LigneProduit)),
      byStatus: groupes.map((groupe) => ({
        status: groupe.status as ProductStatus,
        count: groupe._count._all,
      })),
    };
  }

  private formatMarche(row: {
    localPriceMinXaf: number | null;
    localPriceMaxXaf: number | null;
    localPriceObservedAt: Date | null;
    localPriceSource: string | null;
    localPriceProvenance: AdminProductMarket['localPriceProvenance'];
    demand: AdminProductMarket['demand'];
    competition: AdminProductMarket['competition'];
    risk: AdminProductMarket['risk'];
    transportEase: AdminProductMarket['transportEase'];
    capitalRequiredXaf: number | null;
    assessedAt: Date | null;
    assessmentSource: string | null;
    assessmentProvenance: AdminProductMarket['assessmentProvenance'];
  }): AdminProductMarket {
    return {
      localPriceMinXaf: row.localPriceMinXaf,
      localPriceMaxXaf: row.localPriceMaxXaf,
      localPriceObservedAt: row.localPriceObservedAt?.toISOString() ?? null,
      localPriceSource: row.localPriceSource,
      localPriceProvenance: row.localPriceProvenance,
      demand: row.demand,
      competition: row.competition,
      risk: row.risk,
      transportEase: row.transportEase,
      capitalRequiredXaf: row.capitalRequiredXaf,
      assessedAt: row.assessedAt?.toISOString() ?? null,
      assessmentSource: row.assessmentSource,
      assessmentProvenance: row.assessmentProvenance,
    };
  }

  async detail(id: string): Promise<AdminProductDetailResponse> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: {
        _count: { select: { images: true } },
        images: { orderBy: { position: 'asc' } },
        marketData: true,
      },
    });
    if (!row) throw new NotFoundException('Ce produit n’existe pas.');

    return {
      product: this.format(row as unknown as LigneProduit),
      market: row.marketData ? this.formatMarche(row.marketData) : null,
      images: row.images.map((image) => ({
        id: image.id,
        url: image.url,
        alt: image.alt,
        position: image.position,
      })),
    };
  }

  /** Slug unique : on suffixe tant que le nom est déjà pris, sans jamais écraser une fiche. */
  private async slugLibre(nom: string, saufId?: string): Promise<string> {
    const base = slugifier(nom) || 'produit';
    for (let suffixe = 0; suffixe < 50; suffixe += 1) {
      const candidat = suffixe === 0 ? base : `${base}-${suffixe + 1}`;
      const existant = await this.prisma.product.findUnique({ where: { slug: candidat } });
      if (!existant || existant.id === saufId) return candidat;
    }
    throw new BadRequestException('Trop de produits portent déjà ce nom : précisez-le.');
  }

  async create(
    input: CreateProductRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminProductDetailResponse> {
    const slug = await this.slugLibre(input.name);
    // Le prix en FCFA est calculé ici, à partir du taux fourni : l'interface ne l'envoie
    // pas, pour qu'un prix affiché corresponde toujours au taux enregistré à côté.
    const purchasePriceXaf = Math.round(input.purchasePriceMinor * input.exchangeRate);

    const row = await this.prisma.product.create({
      data: {
        slug,
        name: input.name,
        description: input.description,
        category: input.category,
        status: 'DRAFT',
        purchasePriceMinor: input.purchasePriceMinor,
        purchaseCurrency: input.purchaseCurrency,
        purchasePriceXaf,
        exchangeRate: input.exchangeRate,
        exchangeRateAt: new Date(input.exchangeRateAt),
        exchangeRateSource: input.exchangeRateSource,
        moq: input.moq,
        weightGrams: input.weightGrams,
        volumeCm3: input.volumeCm3,
        badges: input.badges,
        watchPoints: input.watchPoints,
        supplierIds: input.supplierIds,
      },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'product.create',
      entity: 'Product',
      entityId: row.id,
      metadata: { slug, name: input.name },
      ipAddress: ip,
    });

    return this.detail(row.id);
  }

  async update(
    id: string,
    input: UpdateProductRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminProductDetailResponse> {
    const existant = await this.prisma.product.findUnique({ where: { id } });
    if (!existant) throw new NotFoundException('Ce produit n’existe pas.');

    const taux = input.exchangeRate ?? Number(existant.exchangeRate);
    const prixMinor = input.purchasePriceMinor ?? existant.purchasePriceMinor;
    const recalculerPrix = input.exchangeRate !== undefined || input.purchasePriceMinor !== undefined;

    await this.prisma.product.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name, slug: await this.slugLibre(input.name, id) } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.purchasePriceMinor !== undefined
          ? { purchasePriceMinor: input.purchasePriceMinor }
          : {}),
        ...(input.purchaseCurrency !== undefined ? { purchaseCurrency: input.purchaseCurrency } : {}),
        ...(input.exchangeRate !== undefined ? { exchangeRate: input.exchangeRate } : {}),
        ...(input.exchangeRateAt !== undefined
          ? { exchangeRateAt: new Date(input.exchangeRateAt) }
          : {}),
        ...(input.exchangeRateSource !== undefined
          ? { exchangeRateSource: input.exchangeRateSource }
          : {}),
        ...(recalculerPrix ? { purchasePriceXaf: Math.round(prixMinor * taux) } : {}),
        ...(input.moq !== undefined ? { moq: input.moq } : {}),
        ...(input.weightGrams !== undefined ? { weightGrams: input.weightGrams } : {}),
        ...(input.volumeCm3 !== undefined ? { volumeCm3: input.volumeCm3 } : {}),
        ...(input.badges !== undefined ? { badges: input.badges } : {}),
        ...(input.watchPoints !== undefined ? { watchPoints: input.watchPoints } : {}),
        ...(input.supplierIds !== undefined ? { supplierIds: input.supplierIds } : {}),
      },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'product.update',
      entity: 'Product',
      entityId: id,
      metadata: { champs: Object.keys(input) },
      ipAddress: ip,
    });

    return this.detail(id);
  }

  /**
   * Publication et retrait. Publier exige une fiche complète ; retirer n'exige rien
   * d'autre qu'un motif — on doit toujours pouvoir dépublier vite.
   */
  async changeStatus(
    id: string,
    input: UpdateProductStatusRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminProductDetailResponse> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { images: true } } },
    });
    if (!row) throw new NotFoundException('Ce produit n’existe pas.');

    if (input.status === 'PUBLISHED') {
      const manques = this.manquePourPublier(row as unknown as LigneProduit);
      if (manques.length > 0) {
        throw new BadRequestException(
          `Cette fiche ne peut pas être publiée. Il manque : ${manques.join(' ; ')}.`,
        );
      }
    }

    await this.prisma.product.update({
      where: { id },
      data: {
        status: input.status,
        // La date de publication est posée au premier passage au public et conservée
        // ensuite : un produit republié garde la date à laquelle il est apparu.
        publishedAt: input.status === 'PUBLISHED' ? (row.publishedAt ?? new Date()) : row.publishedAt,
      },
    });

    await this.audit.record({
      actorId: acteur.id,
      action: `product.${input.status.toLowerCase()}`,
      entity: 'Product',
      entityId: id,
      metadata: { depuis: row.status, vers: input.status, motif: input.reason },
      ipAddress: ip,
    });

    return this.detail(id);
  }

  /** Relevé de marché. Les règles de cohérence sont portées par le schéma Zod du contrat. */
  async updateMarket(
    id: string,
    input: UpdateProductMarketRequest,
    acteur: { id: string },
    ip: string | null,
  ): Promise<AdminProductDetailResponse> {
    const existant = await this.prisma.product.findUnique({ where: { id } });
    if (!existant) throw new NotFoundException('Ce produit n’existe pas.');

    const donnees = {
      localPriceMinXaf: input.localPriceMinXaf,
      localPriceMaxXaf: input.localPriceMaxXaf,
      localPriceObservedAt: input.localPriceObservedAt ? new Date(input.localPriceObservedAt) : null,
      localPriceSource: input.localPriceSource,
      localPriceProvenance: input.localPriceProvenance,
      demand: input.demand,
      competition: input.competition,
      risk: input.risk,
      transportEase: input.transportEase,
      capitalRequiredXaf: input.capitalRequiredXaf,
      assessedAt: input.assessedAt ? new Date(input.assessedAt) : null,
      assessmentSource: input.assessmentSource,
      assessmentProvenance: input.assessmentProvenance,
    };

    await this.prisma.productMarketData.upsert({
      where: { productId: id },
      create: { productId: id, ...donnees },
      update: donnees,
    });

    await this.audit.record({
      actorId: acteur.id,
      action: 'product.market',
      entity: 'Product',
      entityId: id,
      metadata: {
        prixLocal:
          input.localPriceMinXaf === null && input.localPriceMaxXaf === null
            ? 'effacé'
            : `${input.localPriceMinXaf ?? '—'}–${input.localPriceMaxXaf ?? '—'} FCFA`,
        source: input.localPriceSource,
      },
      ipAddress: ip,
    });

    return this.detail(id);
  }
}
