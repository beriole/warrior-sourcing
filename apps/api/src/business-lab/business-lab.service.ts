import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  computeBusinessMetrics,
  describeBusinessProgress,
  type BusinessProject,
  type BusinessProjectDetail,
  type BusinessProjectInput,
  type BusinessProjectListResponse,
  type BusinessProjectResponse,
  type BusinessSaleInput,
} from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';

type LigneVente = {
  id: string;
  quantity: number;
  unitPriceXaf: number;
  soldAt: Date;
  note: string | null;
};

type LigneProjet = {
  id: string;
  name: string;
  capitalXaf: number;
  quantity: number;
  targetUnitPriceXaf: number;
  orderReference: string | null;
  startedAt: Date;
  notes: string | null;
  createdAt: Date;
  sales: LigneVente[];
};

/**
 * Business Lab (lot LAB, §27).
 *
 * Les indicateurs ne sont jamais stockés : ils sont recalculés à chaque lecture par
 * `computeBusinessMetrics`, la même fonction que l'écran pourrait appeler. Un chiffre
 * enregistré se serait désynchronisé à la première correction de vente, et personne
 * n'aurait su lequel croire.
 *
 * Aucune projection : les indicateurs ne portent que sur les ventes réellement saisies.
 * Dire « au rythme actuel, vous aurez tout vendu dans trois semaines » serait inventer
 * une donnée que personne n'a mesurée (§54).
 */
@Injectable()
export class BusinessLabService {
  constructor(private readonly prisma: PrismaService) {}

  private format(row: LigneProjet): BusinessProject {
    const metrics = computeBusinessMetrics(row, row.sales);
    return {
      id: row.id,
      name: row.name,
      capitalXaf: row.capitalXaf,
      quantity: row.quantity,
      targetUnitPriceXaf: row.targetUnitPriceXaf,
      orderReference: row.orderReference,
      startedAt: row.startedAt.toISOString(),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      metrics,
      progressLabel: describeBusinessProgress(metrics),
      saleCount: row.sales.length,
    };
  }

  private detail(row: LigneProjet): BusinessProjectDetail {
    return {
      ...this.format(row),
      sales: row.sales.map((vente) => ({
        id: vente.id,
        quantity: vente.quantity,
        unitPriceXaf: vente.unitPriceXaf,
        soldAt: vente.soldAt.toISOString(),
        note: vente.note,
        totalXaf: vente.quantity * vente.unitPriceXaf,
      })),
    };
  }

  private static readonly INCLUSION = { sales: { orderBy: { soldAt: 'desc' as const } } } as const;

  async list(userId: string): Promise<BusinessProjectListResponse> {
    const rows = await this.prisma.businessProject.findMany({
      where: { userId },
      include: BusinessLabService.INCLUSION,
      orderBy: { startedAt: 'desc' },
    });

    const items = rows.map((row) => this.format(row as unknown as LigneProjet));

    return {
      items,
      totalCapitalXaf: items.reduce((total, item) => total + item.capitalXaf, 0),
      totalRevenueXaf: items.reduce((total, item) => total + item.metrics.revenueXaf, 0),
      totalMarginXaf: items.reduce((total, item) => total + item.metrics.marginXaf, 0),
    };
  }

  /** Un projet n'est lisible que par son auteur : c'est sa comptabilité. */
  private async trouver(id: string, userId: string): Promise<LigneProjet> {
    const row = await this.prisma.businessProject.findFirst({
      where: { id, userId },
      include: BusinessLabService.INCLUSION,
    });
    if (!row) throw new NotFoundException('Ce projet n’existe pas.');
    return row as unknown as LigneProjet;
  }

  async findOne(id: string, userId: string): Promise<BusinessProjectResponse> {
    return { project: this.detail(await this.trouver(id, userId)) };
  }

  async create(userId: string, input: BusinessProjectInput): Promise<BusinessProjectResponse> {
    const row = await this.prisma.businessProject.create({
      data: {
        userId,
        name: input.name,
        capitalXaf: input.capitalXaf,
        quantity: input.quantity,
        targetUnitPriceXaf: input.targetUnitPriceXaf,
        orderReference: input.orderReference,
        startedAt: new Date(input.startedAt),
        notes: input.notes,
      },
      include: BusinessLabService.INCLUSION,
    });
    return { project: this.detail(row as unknown as LigneProjet) };
  }

  async update(
    id: string,
    userId: string,
    input: BusinessProjectInput,
  ): Promise<BusinessProjectResponse> {
    const existant = await this.trouver(id, userId);

    // Réduire le lot sous ce qui est déjà vendu rendrait les indicateurs incohérents,
    // et l'utilisateur ne saurait pas lequel de ses deux chiffres est faux.
    const vendues = existant.sales.reduce((total, vente) => total + vente.quantity, 0);
    if (input.quantity < vendues) {
      throw new BadRequestException(
        `Vous avez déjà saisi ${vendues} unités vendues : la quantité du lot ne peut pas être inférieure.`,
      );
    }

    await this.prisma.businessProject.update({
      where: { id },
      data: {
        name: input.name,
        capitalXaf: input.capitalXaf,
        quantity: input.quantity,
        targetUnitPriceXaf: input.targetUnitPriceXaf,
        orderReference: input.orderReference,
        startedAt: new Date(input.startedAt),
        notes: input.notes,
      },
    });

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<{ deleted: true }> {
    await this.trouver(id, userId);
    // Les ventes partent avec le projet : elles n'ont aucun sens séparées de lui.
    await this.prisma.businessProject.delete({ where: { id } });
    return { deleted: true };
  }

  async addSale(id: string, userId: string, input: BusinessSaleInput): Promise<BusinessProjectResponse> {
    await this.trouver(id, userId);

    await this.prisma.businessSale.create({
      data: {
        projectId: id,
        quantity: input.quantity,
        unitPriceXaf: input.unitPriceXaf,
        soldAt: new Date(input.soldAt),
        note: input.note,
      },
    });

    // Une saisie au-delà du lot n'est pas refusée : elle est signalée par `oversold`.
    // Refuser forcerait à corriger la quantité avant d'enregistrer une vente réelle,
    // alors que c'est souvent la quantité achetée qui était mal notée.
    return this.findOne(id, userId);
  }

  async removeSale(id: string, saleId: string, userId: string): Promise<BusinessProjectResponse> {
    await this.trouver(id, userId);

    const { count } = await this.prisma.businessSale.deleteMany({ where: { id: saleId, projectId: id } });
    if (count === 0) throw new NotFoundException('Cette vente n’existe pas.');

    return this.findOne(id, userId);
  }
}
