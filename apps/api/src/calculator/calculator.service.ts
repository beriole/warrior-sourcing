import { Injectable, NotFoundException } from '@nestjs/common';
import {
  computeImportCalculation,
  computeShipmentMeasures,
  ImportCalculationInputSchema,
  SHIPPING_MODES,
  selectFreightRate,
  type FreightRate,
  type ImportCalculationInput,
  type ImportCalculationResponse,
  type ImportCalculationResultResponse,
  type SaveSimulationRequest,
  type ShippingMode,
  type SimulationListResponse,
  type SimulationResponse,
} from '@ws/contracts';
import { CargoService } from '../cargo/cargo.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Prisma attend une valeur JSON : la sérialisation garantit un objet simple et stable. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJson(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}

type SimulationRow = {
  id: string;
  label: string;
  mode: ShippingMode;
  quantity: number;
  totalXaf: number;
  unitLandedCostXaf: number;
  createdAt: Date;
  updatedAt: Date;
  input: unknown;
  result: unknown;
  forwarder?: { name: string } | null;
};

/**
 * Calculateur d'importation (lot CALC).
 * Les tarifs viennent des grilles saisies (lot CARGO) : aucun prix de transport
 * n'est écrit dans ce fichier. Sans transitaire, le moteur bascule de lui-même
 * sur une fourchette marquée « estimation », datée et sourcée.
 */
@Injectable()
export class CalculatorService {
  constructor(
    private readonly cargo: CargoService,
    private readonly prisma: PrismaService,
  ) {}

  /** Calcule le mode demandé et les deux autres, pour la comparaison côte à côte (CALC-04). */
  async compute(rawInput: ImportCalculationInput): Promise<ImportCalculationResponse> {
    const input = ImportCalculationInputSchema.parse(rawInput);
    const at = new Date();
    const rates = input.forwarderId ? await this.cargo.ratesForEngine(input.forwarderId, at) : [];

    const forMode = (mode: ShippingMode): ImportCalculationResultResponse => {
      const measures = computeShipmentMeasures(input.parcels, mode);
      const rate = this.applicableRate(rates, mode, measures.chargeableWeightKg, at);
      return computeImportCalculation(
        {
          ...input,
          mode,
          // Un fret saisi à la main ne vaut que pour le mode demandé : le comparer
          // aux autres modes avec le même montant n'aurait aucun sens.
          freightOverride: mode === input.mode ? input.freightOverride : undefined,
        },
        { rate, at },
      );
    };

    return {
      provenance: 'ESTIMATE',
      result: forMode(input.mode),
      comparison: SHIPPING_MODES.map(forMode),
    };
  }

  async listSimulations(userId: string): Promise<SimulationListResponse> {
    const simulations = await this.prisma.importSimulation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { forwarder: { select: { name: true } } },
    });

    return {
      simulations: simulations.map((simulation) => toSummary(simulation)),
      total: simulations.length,
    };
  }

  async getSimulation(userId: string, id: string): Promise<SimulationResponse> {
    const simulation = await this.prisma.importSimulation.findFirst({
      where: { id, userId },
      include: { forwarder: { select: { name: true } } },
    });
    if (!simulation) throw new NotFoundException("Cette simulation n'existe plus.");

    return toSimulation(simulation);
  }

  /** Enregistre une simulation en recalculant côté serveur : le client ne fait jamais foi. */
  async saveSimulation(userId: string, body: SaveSimulationRequest): Promise<SimulationResponse> {
    const input = ImportCalculationInputSchema.parse(body.input);
    const computed = await this.compute(input);

    const created = await this.prisma.importSimulation.create({
      data: {
        userId,
        label: body.label,
        mode: computed.result.mode,
        forwarderId: computed.result.freight.forwarderId,
        quantity: computed.result.quantity,
        input: toJson(input),
        result: toJson(computed.result),
        totalXaf: computed.result.costs.total,
        unitLandedCostXaf: computed.result.unitLandedCost,
      },
      include: { forwarder: { select: { name: true } } },
    });

    return toSimulation(created);
  }

  /**
   * Duplication (CALC-05) : la copie est recalculée avec les tarifs du jour.
   * Un tarif a pu changer depuis l'original ; mieux vaut le montant juste que le montant figé.
   */
  async duplicateSimulation(userId: string, id: string): Promise<SimulationResponse> {
    const original = await this.prisma.importSimulation.findFirst({ where: { id, userId } });
    if (!original) throw new NotFoundException("Cette simulation n'existe plus.");

    return this.saveSimulation(userId, {
      label: `Copie de ${original.label}`.slice(0, 120),
      input: ImportCalculationInputSchema.parse(original.input),
    });
  }

  async deleteSimulation(userId: string, id: string): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.importSimulation.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Cette simulation n'existe plus.");

    await this.prisma.importSimulation.delete({ where: { id } });
    return { deleted: true };
  }

  private applicableRate(
    rates: FreightRate[],
    mode: ShippingMode,
    chargeableWeightKg: number,
    at: Date,
  ): FreightRate | null {
    if (rates.length === 0) return null;
    return selectFreightRate(rates, { mode, chargeableWeightKg, at });
  }
}

function toSummary(row: SimulationRow) {
  return {
    id: row.id,
    label: row.label,
    mode: row.mode,
    forwarderName: row.forwarder?.name ?? null,
    quantity: row.quantity,
    totalXaf: row.totalXaf,
    unitLandedCostXaf: row.unitLandedCostXaf,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSimulation(row: SimulationRow): SimulationResponse {
  return {
    ...toSummary(row),
    input: row.input,
    result: row.result as ImportCalculationResultResponse,
  };
}
