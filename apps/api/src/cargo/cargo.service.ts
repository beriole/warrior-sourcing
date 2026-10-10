import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FREIGHT_FALLBACK_OBSERVED_AT,
  FREIGHT_FALLBACK_RANGES,
  FREIGHT_FALLBACK_SOURCE,
  SHIPPING_MODES,
  selectFreightRate,
  type CargoOptionsResponse,
  type CreateForwarderRequest,
  type CreateFreightRateData,
  type ForwarderDetailResponse,
  type ForwarderListResponse,
  type ForwarderResponse,
  type ForwarderSearchQuery,
  type FreightRate,
  type FreightRateResponse,
  type ShippingMode,
  type UpdateForwarderRequest,
} from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';

/** Ligne de grille telle qu'elle sort de la base. */
type RateRow = {
  id: string;
  forwarderId: string;
  mode: ShippingMode;
  unit: 'KG' | 'CBM';
  unitPriceXaf: number;
  minimumChargeXaf: number;
  weightBreakKg: number;
  transitDays: number;
  effectiveFrom: Date;
  source: string;
  active: boolean;
  createdAt: Date;
};

type ForwarderRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  cities: string[];
  modes: ShippingMode[];
  active: boolean;
  notes: string | null;
  warehouseName: string | null;
  warehouseAddressZh: string | null;
  warehouseAddressLatin: string | null;
  warehouseContactName: string | null;
  warehousePhone: string | null;
  warehouseInstructions: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Transitaires et grilles tarifaires (lot CARGO).
 * Règle centrale : un tarif ne se modifie pas, il se remplace par un tarif daté.
 * L'ancien reste en base pour que l'on sache toujours quel prix a servi, et quand.
 */
@Injectable()
export class CargoService {
  constructor(private readonly prisma: PrismaService) {}

  async listForwarders(query: ForwarderSearchQuery): Promise<ForwarderListResponse> {
    const actif = query.actif ?? 'oui';
    const where: Record<string, unknown> = {};

    if (actif !== 'tous') where.active = actif === 'oui';
    if (query.mode) where.modes = { has: query.mode };
    if (query.ville) where.cities = { has: query.ville };
    if (query.recherche) {
      where.OR = [
        { name: { contains: query.recherche, mode: 'insensitive' } },
        { contactName: { contains: query.recherche, mode: 'insensitive' } },
        { cities: { has: query.recherche } },
      ];
    }

    const forwarders = await this.prisma.forwarder.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { rates: true } } },
    });

    return {
      forwarders: forwarders.map((forwarder) => toForwarder(forwarder, forwarder._count.rates)),
      total: forwarders.length,
    };
  }

  async getForwarder(id: string): Promise<ForwarderDetailResponse> {
    const forwarder = await this.prisma.forwarder.findUnique({
      where: { id },
      include: {
        _count: { select: { rates: true } },
        // Historique complet, du plus récent au plus ancien : on voit l'évolution des prix.
        rates: { orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    if (!forwarder) throw new NotFoundException("Ce transitaire n'existe pas ou a été supprimé.");

    return {
      forwarder: toForwarder(forwarder, forwarder._count.rates),
      rates: forwarder.rates.map(toRate),
    };
  }

  async createForwarder(input: CreateForwarderRequest, actorId: string): Promise<ForwarderResponse> {
    const forwarder = await this.prisma.forwarder.create({
      data: {
        name: input.name,
        contactName: input.contactName ?? null,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        cities: input.cities ?? [],
        modes: input.modes,
        notes: input.notes ?? null,
        warehouseName: input.warehouseName ?? null,
        // Une chaîne vide n'est pas une adresse : on enregistre l'absence, pour que
        // `hasWarehouseAddress` dise la vérité et que l'assistant n'offre rien à copier.
        warehouseAddressZh: input.warehouseAddressZh || null,
        warehouseAddressLatin: input.warehouseAddressLatin || null,
        warehouseContactName: input.warehouseContactName ?? null,
        warehousePhone: input.warehousePhone ?? null,
        warehouseInstructions: input.warehouseInstructions ?? null,
        createdById: actorId,
      },
    });
    return toForwarder(forwarder, 0);
  }

  async updateForwarder(id: string, input: UpdateForwarderRequest): Promise<ForwarderResponse> {
    await this.ensureForwarder(id);

    const forwarder = await this.prisma.forwarder.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.contactName !== undefined && { contactName: input.contactName }),
        ...(input.contactPhone !== undefined && { contactPhone: input.contactPhone }),
        ...(input.contactEmail !== undefined && { contactEmail: input.contactEmail }),
        ...(input.cities !== undefined && { cities: input.cities }),
        ...(input.modes !== undefined && { modes: input.modes }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.active !== undefined && { active: input.active }),
        ...(input.warehouseName !== undefined && { warehouseName: input.warehouseName || null }),
        ...(input.warehouseAddressZh !== undefined && { warehouseAddressZh: input.warehouseAddressZh || null }),
        ...(input.warehouseAddressLatin !== undefined && {
          warehouseAddressLatin: input.warehouseAddressLatin || null,
        }),
        ...(input.warehouseContactName !== undefined && {
          warehouseContactName: input.warehouseContactName || null,
        }),
        ...(input.warehousePhone !== undefined && { warehousePhone: input.warehousePhone || null }),
        ...(input.warehouseInstructions !== undefined && {
          warehouseInstructions: input.warehouseInstructions || null,
        }),
      },
      include: { _count: { select: { rates: true } } },
    });
    return toForwarder(forwarder, forwarder._count.rates);
  }

  /** Nouvelle grille : elle ne remplace rien, elle date la précédente (CARGO-02). */
  async addRate(
    forwarderId: string,
    input: CreateFreightRateData,
    actorId: string,
  ): Promise<FreightRateResponse> {
    await this.ensureForwarder(forwarderId);

    const rate = await this.prisma.freightRate.create({
      data: {
        forwarderId,
        mode: input.mode,
        unit: input.unit,
        unitPriceXaf: input.unitPriceXaf,
        minimumChargeXaf: input.minimumChargeXaf,
        weightBreakKg: input.weightBreakKg,
        transitDays: input.transitDays,
        effectiveFrom: input.effectiveFrom,
        source: input.source,
        createdById: actorId,
      },
    });
    return toRate(rate);
  }

  /** Mise hors service d'une grille. Le prix reste lisible dans l'historique. */
  async setRateActive(rateId: string, active: boolean): Promise<FreightRateResponse> {
    const existing = await this.prisma.freightRate.findUnique({ where: { id: rateId } });
    if (!existing) throw new NotFoundException("Cette grille tarifaire n'existe pas.");

    const rate = await this.prisma.freightRate.update({ where: { id: rateId }, data: { active } });
    return toRate(rate);
  }

  /** Transitaires actifs et grilles en vigueur, pour le choix dans le calculateur (CARGO-05). */
  async options(at: Date = new Date()): Promise<CargoOptionsResponse> {
    const forwarders = await this.prisma.forwarder.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: {
        rates: {
          where: { active: true, effectiveFrom: { lte: at } },
          orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    return {
      forwarders: forwarders.map((forwarder) => ({
        id: forwarder.id,
        name: forwarder.name,
        cities: forwarder.cities,
        modes: forwarder.modes as ShippingMode[],
        rates: forwarder.rates.map(toRate),
      })),
      fallback: {
        provenance: 'ESTIMATE',
        observedAt: FREIGHT_FALLBACK_OBSERVED_AT,
        source: FREIGHT_FALLBACK_SOURCE,
        ranges: SHIPPING_MODES.map((mode) => ({ mode, ...FREIGHT_FALLBACK_RANGES[mode] })),
      },
    };
  }

  /**
   * Grilles en vigueur d'un transitaire, au format attendu par le moteur de calcul.
   * Renvoie une liste vide si le transitaire est inconnu ou désactivé : le calculateur
   * bascule alors sur la fourchette marquée « estimation ».
   */
  async ratesForEngine(forwarderId: string, at: Date = new Date()): Promise<FreightRate[]> {
    const forwarder = await this.prisma.forwarder.findFirst({
      where: { id: forwarderId, active: true },
      include: {
        rates: { where: { active: true, effectiveFrom: { lte: at } } },
      },
    });
    if (!forwarder) return [];

    return forwarder.rates.map((rate) => ({
      id: rate.id,
      forwarderId: forwarder.id,
      forwarderName: forwarder.name,
      mode: rate.mode as ShippingMode,
      unit: rate.unit as 'KG' | 'CBM',
      unitPriceXaf: rate.unitPriceXaf,
      minimumChargeXaf: rate.minimumChargeXaf,
      weightBreakKg: rate.weightBreakKg,
      transitDays: rate.transitDays,
      effectiveFrom: rate.effectiveFrom,
      source: rate.source,
    }));
  }

  /** Grille applicable à un envoi précis, ou null si aucune ne couvre ce poids. */
  selectRate(
    rates: FreightRate[],
    params: { mode: ShippingMode; chargeableWeightKg: number; at?: Date },
  ): FreightRate | null {
    return selectFreightRate(rates, params);
  }

  private async ensureForwarder(id: string): Promise<void> {
    const exists = await this.prisma.forwarder.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException("Ce transitaire n'existe pas ou a été supprimé.");
  }
}

function toForwarder(row: ForwarderRow, rateCount: number): ForwarderResponse {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    cities: row.cities,
    modes: row.modes,
    active: row.active,
    notes: row.notes,
    warehouseName: row.warehouseName,
    warehouseAddressZh: row.warehouseAddressZh,
    warehouseAddressLatin: row.warehouseAddressLatin,
    warehouseContactName: row.warehouseContactName,
    warehousePhone: row.warehousePhone,
    warehouseInstructions: row.warehouseInstructions,
    // L'adresse chinoise décide : sans elle, l'assistant n'a rien à faire copier.
    hasWarehouseAddress: Boolean(row.warehouseAddressZh),
    rateCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRate(row: RateRow): FreightRateResponse {
  return {
    id: row.id,
    forwarderId: row.forwarderId,
    mode: row.mode,
    unit: row.unit,
    unitPriceXaf: row.unitPriceXaf,
    minimumChargeXaf: row.minimumChargeXaf,
    weightBreakKg: row.weightBreakKg,
    transitDays: row.transitDays,
    effectiveFrom: row.effectiveFrom.toISOString(),
    source: row.source,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}
