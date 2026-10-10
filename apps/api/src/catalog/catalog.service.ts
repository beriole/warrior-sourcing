import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CATALOG_COST_ASSUMPTION_LIST,
  CATALOG_TAB_LABELS,
  COMPETITION_LEVEL_LABELS,
  DEMAND_LEVEL_LABELS,
  ESTIMATE_WARNING,
  INTEREST_CATEGORY_LABELS,
  RISK_LEVEL_LABELS,
  TRANSPORT_EASE_LABELS,
  type CatalogListResponse,
  type CatalogProductCard,
  type CatalogProductDetail,
  type CatalogQuery,
  type CatalogTab,
  type InvestmentSimulationResponse,
  type MarketLevel,
  type ObservedLocalPrice,
  type PotentialMargin,
  type RiskLevel,
} from '@ws/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { estimateLandedCost, estimateWithSale, quantityForBudget } from './landed-cost.js';
import { budgetBounds, rankForProfile, type PersonalizationProfile } from './personalization.js';

type ProductRow = Prisma.ProductGetPayload<{ include: { images: true; marketData: true } }>;

/** Un produit et ses chiffres dérivés : calculés une fois, réutilisés pour trier et filtrer. */
interface CatalogEntry {
  row: ProductRow;
  card: CatalogProductCard;
}

/** Sécurité : au-delà, la liste est paginée côté base plutôt que chargée entièrement. */
const MAX_ROWS = 500;

/** Rang des niveaux, pour trier sans dépendre de l'ordre alphabétique des valeurs. */
const LEVEL_RANK: Record<MarketLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const RISK_RANK: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste paginée des opportunités (§12).
   *
   * Les filtres portant sur des colonnes vont à la base ; ceux qui portent sur un chiffre
   * calculé (investissement minimum, marge) sont appliqués après calcul. Le tri se termine
   * toujours par l'identifiant : deux appels identiques renvoient donc la même page.
   */
  async list(query: CatalogQuery, profile: PersonalizationProfile | null): Promise<CatalogListResponse> {
    const rows = await this.prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        ...(query.category ? { category: query.category } : {}),
        ...(query.moqMax ? { moq: { lte: query.moqMax } } : {}),
        ...(query.weightMaxGrams ? { weightGrams: { lte: query.weightMaxGrams } } : {}),
        ...(query.riskMax || query.transportEase
          ? {
              marketData: {
                ...(query.riskMax ? { risk: { in: risksUpTo(query.riskMax) } } : {}),
                ...(query.transportEase ? { transportEase: query.transportEase } : {}),
              },
            }
          : {}),
      },
      include: { images: { orderBy: { position: 'asc' } }, marketData: true },
      orderBy: { id: 'asc' },
      take: MAX_ROWS,
    });

    let entries: CatalogEntry[] = rows.map((row) => ({ row, card: toCard(row) }));

    if (query.budgetMaxXaf !== undefined) {
      const budget = query.budgetMaxXaf;
      entries = entries.filter((entry) => entry.card.minimumOrder.totalXaf <= budget);
    }
    if (query.marginMinPercent !== undefined) {
      const minimum = query.marginMinPercent;
      entries = entries.filter(
        (entry) => entry.card.potentialMargin !== null && entry.card.potentialMargin.marginPercent >= minimum,
      );
    }

    const personalized = query.tab === 'FOR_YOU' && profile !== null;
    const sorted = personalized ? forYou(entries, profile) : sortByTab(entries, query.tab);

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / query.perPage));
    const page = Math.min(query.page, totalPages);
    const start = (page - 1) * query.perPage;

    return {
      tab: query.tab,
      tabLabel: CATALOG_TAB_LABELS[query.tab].label,
      tabDescription: CATALOG_TAB_LABELS[query.tab].description,
      personalized,
      personalizationNote: personalizationNote(query.tab, profile),
      page,
      perPage: query.perPage,
      total,
      totalPages,
      items: sorted.slice(start, start + query.perPage).map((entry) => entry.card),
    };
  }

  /** Fiche produit (§13). Accepte l'identifiant ou le libellé d'URL. */
  async product(idOrSlug: string): Promise<CatalogProductDetail> {
    const row = await this.findPublished(idOrSlug);

    return {
      ...toCard(row),
      description: row.description,
      images: row.images.map((image) => ({ url: image.url, alt: image.alt })),
      watchPoints: row.watchPoints,
      supplierIds: row.supplierIds,
      costAssumptions: CATALOG_COST_ASSUMPTION_LIST,
      estimateWarning: ESTIMATE_WARNING,
    };
  }

  /**
   * Simulateur d'investissement (§14).
   * Le budget donne une quantité, jamais l'inverse : on ne pousse pas à dépenser plus.
   */
  async simulate(idOrSlug: string, budgetXaf: number): Promise<InvestmentSimulationResponse> {
    const row = await this.findPublished(idOrSlug);
    const card = toCard(row);

    const affordable = quantityForBudget(row, budgetXaf);
    const belowMinimumOrder = affordable < row.moq;
    // Sous la quantité minimum, on montre quand même ce que coûterait cette quantité minimum :
    // c'est l'information utile, accompagnée d'un avertissement explicite côté interface.
    const quantity = belowMinimumOrder ? row.moq : affordable;

    const cost = estimateLandedCost(row, quantity);
    const localPrice = card.localPrice;

    let sale: InvestmentSimulationResponse['sale'] = null;
    let saleUnavailableReason: string | null =
      'Aucun prix local n’a encore été relevé pour ce produit : nous ne pouvons ni estimer votre chiffre d’affaires, ni votre marge.';

    if (localPrice) {
      // Prudence : on retient la borne basse de la fourchette relevée.
      const result = estimateWithSale(row, quantity, localPrice.minXaf);
      if (result.selling) {
        sale = {
          unitSellingPriceXaf: result.selling.unitSellingPrice,
          potentialRevenueXaf: result.selling.revenue,
          totalMarginXaf: result.selling.totalMargin,
          unitMarginXaf: result.selling.unitMargin,
          roiPercent: Math.round(result.selling.roi * 1000) / 10,
          breakEvenUnits: result.selling.breakEvenUnits,
          basedOnPriceObservedAt: localPrice.observedAt,
          basedOnPriceSource: localPrice.source,
        };
        saleUnavailableReason = null;
      }
    }

    return {
      provenance: 'ESTIMATE',
      warning: ESTIMATE_WARNING,
      productId: row.id,
      productName: row.name,
      budgetXaf,
      quantity,
      belowMinimumOrder,
      totalInvestmentXaf: cost.totalXaf,
      unitLandedCostXaf: cost.unitXaf,
      remainingBudgetXaf: Math.max(0, budgetXaf - cost.totalXaf),
      cost,
      sale,
      saleUnavailableReason,
      assumptions: CATALOG_COST_ASSUMPTION_LIST,
    };
  }

  private async findPublished(idOrSlug: string): Promise<ProductRow> {
    const row = await this.prisma.product.findFirst({
      where: { status: 'PUBLISHED', OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { images: { orderBy: { position: 'asc' } }, marketData: true },
    });
    if (!row) throw new NotFoundException('Ce produit n’existe pas ou n’est plus publié.');
    return row;
  }
}

/** Niveaux de risque acceptés quand l'utilisateur fixe un risque maximum. */
function risksUpTo(maximum: RiskLevel): RiskLevel[] {
  return (['LOW', 'MEDIUM', 'HIGH'] as const).filter((level) => RISK_RANK[level] <= RISK_RANK[maximum]);
}

/** Traduit une ligne de base en carte d'opportunité : aucune donnée absente n'est comblée. */
function toCard(row: ProductRow): CatalogProductCard {
  const minimumOrder = estimateLandedCost(row, row.moq);
  const localPrice = toLocalPrice(row);
  const image = row.images[0];

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    categoryLabel: INTEREST_CATEGORY_LABELS[row.category],
    image: image ? { url: image.url, alt: image.alt } : null,
    purchasePrice: {
      amountMinor: row.purchasePriceMinor,
      currency: row.purchaseCurrency,
      amountXaf: row.purchasePriceXaf,
      exchangeRate: Number(row.exchangeRate),
      exchangeRateObservedAt: row.exchangeRateAt.toISOString(),
      exchangeRateSource: row.exchangeRateSource,
    },
    moq: row.moq,
    weightGrams: row.weightGrams,
    volumeCm3: row.volumeCm3,
    badges: row.badges,
    minimumOrder,
    localPrice,
    potentialMargin: toMargin(localPrice, minimumOrder.unitXaf),
    market: toMarket(row),
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
  };
}

/** Un prix local n'existe que complet : fourchette, date et source. Sinon il n'est pas affiché. */
function toLocalPrice(row: ProductRow): ObservedLocalPrice | null {
  const data = row.marketData;
  if (
    !data ||
    data.localPriceMinXaf === null ||
    data.localPriceMaxXaf === null ||
    data.localPriceObservedAt === null ||
    data.localPriceSource === null
  ) {
    return null;
  }

  return {
    minXaf: data.localPriceMinXaf,
    maxXaf: data.localPriceMaxXaf,
    observedAt: data.localPriceObservedAt.toISOString(),
    source: data.localPriceSource,
    provenance: data.localPriceProvenance,
  };
}

/** Marge potentielle : adossée à la borne basse du prix relevé, donc prudente. */
function toMargin(localPrice: ObservedLocalPrice | null, unitLandedCostXaf: number): PotentialMargin | null {
  if (!localPrice || unitLandedCostXaf <= 0) return null;
  const unitMarginXaf = localPrice.minXaf - unitLandedCostXaf;

  return {
    unitSellingPriceXaf: localPrice.minXaf,
    unitLandedCostXaf,
    unitMarginXaf,
    marginPercent: Math.round((unitMarginXaf / unitLandedCostXaf) * 100),
    basedOnPriceObservedAt: localPrice.observedAt,
    basedOnPriceSource: localPrice.source,
    provenance: 'ESTIMATE',
  };
}

/** Appréciation du marché : sans date ni source, elle n'est pas renvoyée. */
function toMarket(row: ProductRow): CatalogProductCard['market'] {
  const data = row.marketData;
  if (!data || data.assessedAt === null || data.assessmentSource === null) return null;

  return {
    demand: data.demand,
    demandLabel: data.demand ? DEMAND_LEVEL_LABELS[data.demand] : null,
    competition: data.competition,
    competitionLabel: data.competition ? COMPETITION_LEVEL_LABELS[data.competition] : null,
    risk: data.risk,
    riskLabel: data.risk ? RISK_LEVEL_LABELS[data.risk] : null,
    transportEase: data.transportEase,
    transportEaseLabel: data.transportEase ? TRANSPORT_EASE_LABELS[data.transportEase] : null,
    capitalRequiredXaf: data.capitalRequiredXaf,
    assessedAt: data.assessedAt.toISOString(),
    source: data.assessmentSource,
    provenance: data.assessmentProvenance,
  };
}

/** Classement « Pour vous » : la règle testée dans personalization.spec.ts. */
function forYou(entries: CatalogEntry[], profile: PersonalizationProfile): CatalogEntry[] {
  const ranked = rankForProfile(
    entries.map((entry) => ({
      id: entry.card.id,
      category: entry.card.category,
      minimumOrderTotalXaf: entry.card.minimumOrder.totalXaf,
      marginPercent: entry.card.potentialMargin?.marginPercent ?? null,
      risk: entry.card.market?.risk ?? null,
    })),
    profile,
  );

  const byId = new Map(entries.map((entry) => [entry.card.id, entry]));
  return ranked.map((item) => byId.get(item.id)).filter((entry): entry is CatalogEntry => entry !== undefined);
}

/**
 * Tri d'un onglet. Chaque comparaison se termine par l'identifiant : le classement
 * ne bouge pas entre deux pages, et une donnée absente passe derrière sans être inventée.
 */
function sortByTab(entries: CatalogEntry[], tab: CatalogTab): CatalogEntry[] {
  const byId = (left: CatalogEntry, right: CatalogEntry) => left.card.id.localeCompare(right.card.id);

  return [...entries].sort((left, right) => {
    switch (tab) {
      case 'NEW': {
        const difference = Date.parse(right.card.publishedAt) - Date.parse(left.card.publishedAt);
        return difference !== 0 ? difference : byId(left, right);
      }
      case 'TRENDING': {
        // Demande relevée la plus forte d'abord, puis le relevé le plus récent.
        const rank = levelRank(right.card.market?.demand) - levelRank(left.card.market?.demand);
        if (rank !== 0) return rank;
        const freshness = assessedAt(right) - assessedAt(left);
        return freshness !== 0 ? freshness : byId(left, right);
      }
      case 'LOW_COMPETITION': {
        // Concurrence la plus faible d'abord ; un produit sans relevé passe derrière.
        const rank = competitionRank(left.card.market?.competition) - competitionRank(right.card.market?.competition);
        return rank !== 0 ? rank : byId(left, right);
      }
      case 'HIGH_MARGIN': {
        const difference = marginOf(right) - marginOf(left);
        return difference !== 0 ? difference : byId(left, right);
      }
      case 'LOW_BUDGET':
      case 'FOR_YOU':
      default: {
        // Repli de « Pour vous » sans profil : du plus accessible au plus cher.
        const difference = left.card.minimumOrder.totalXaf - right.card.minimumOrder.totalXaf;
        return difference !== 0 ? difference : byId(left, right);
      }
    }
  });
}

function levelRank(level: MarketLevel | null | undefined): number {
  return level ? LEVEL_RANK[level] : 0;
}

/** Sans relevé de concurrence, le produit est placé après tous ceux qui en ont un. */
function competitionRank(level: MarketLevel | null | undefined): number {
  return level ? LEVEL_RANK[level] : Number.MAX_SAFE_INTEGER;
}

function assessedAt(entry: CatalogEntry): number {
  return entry.card.market ? Date.parse(entry.card.market.assessedAt) : 0;
}

/** Sans prix local relevé, aucune marge : le produit ne peut pas figurer en tête de « Forte marge ». */
function marginOf(entry: CatalogEntry): number {
  return entry.card.potentialMargin?.marginPercent ?? Number.NEGATIVE_INFINITY;
}

/** Explique en français ce qui a produit le classement affiché (§45). */
function personalizationNote(tab: CatalogTab, profile: PersonalizationProfile | null): string {
  if (tab !== 'FOR_YOU') return CATALOG_TAB_LABELS[tab].description;

  if (!profile) {
    return 'Connectez-vous et répondez aux quatre questions du profil pour personnaliser cette liste. En attendant, les produits sont classés du moins cher au plus cher à la commande minimum.';
  }

  const { min, max } = budgetBounds(profile.budgetRange);
  const budget =
    max === Number.POSITIVE_INFINITY
      ? `plus de ${min.toLocaleString('fr-FR')} FCFA`
      : `${min.toLocaleString('fr-FR')} à ${max.toLocaleString('fr-FR')} FCFA`;
  const interests = profile.interests.map((interest) => INTEREST_CATEGORY_LABELS[interest]).join(', ');

  return `Classement établi à partir de votre profil : budget de ${budget}, catégories suivies : ${interests || 'aucune'}.`;
}
