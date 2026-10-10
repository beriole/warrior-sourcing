import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DashboardResponseSchema,
  SHIPMENT_STAGE_LABELS,
  SHIPMENT_STAGES,
  type DashboardResponse,
  type ShipmentStage,
} from '@ws/contracts';
import { toOpenApiSchema } from '../common/zod-validation.pipe.js';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { computeNextAction } from './next-action.js';

/** Étapes pendant lesquelles la marchandise voyage (§25). */
const IN_TRANSIT_STAGES: ShipmentStage[] = [
  'SHIPPED_TO_WAREHOUSE',
  'AT_CHINA_WAREHOUSE',
  'INSPECTION',
  'CONSOLIDATION',
  'IN_TRANSIT',
  'ARRIVED_CAMEROON',
  'CUSTOMS',
];

/** Étapes où la marchandise est arrivée et attend son propriétaire. */
const READY_STAGES: ShipmentStage[] = ['AT_LOCAL_WAREHOUSE', 'READY_FOR_PICKUP'];

@ApiTags('Tableau de bord')
@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Activité, commande la plus urgente et prochaine action recommandée' })
  @ApiOkResponse({ schema: toOpenApiSchema(DashboardResponseSchema) })
  async dashboard(@Req() request: AuthenticatedRequest): Promise<DashboardResponse> {
    const userId = request.user.id;

    const [profile, stageCounts, urgentOrder] = await Promise.all([
      this.prisma.importerProfile.findUnique({ where: { userId }, select: { budgetRange: true, interests: true } }),
      this.prisma.order.groupBy({ by: ['stage'], where: { userId }, _count: { _all: true } }),
      this.prisma.order.findFirst({
        where: { userId, stage: { not: 'DELIVERED' } },
        orderBy: { updatedAt: 'desc' },
        select: {
          reference: true,
          stage: true,
          totalXaf: true,
          updatedAt: true,
          events: { orderBy: { occurredAt: 'desc' }, take: 1, select: { description: true, occurredAt: true } },
        },
      }),
    ]);

    const countFor = (stages: ShipmentStage[]) =>
      stageCounts.filter((row) => stages.includes(row.stage)).reduce((total, row) => total + row._count._all, 0);

    const delivered = countFor(['DELIVERED']);
    const activeOrders = stageCounts.reduce((total, row) => total + row._count._all, 0) - delivered;

    const stage = urgentOrder?.stage ?? null;
    const nextStage = stage ? (SHIPMENT_STAGES[SHIPMENT_STAGES.indexOf(stage) + 1] ?? null) : null;

    return {
      user: {
        // Le prénom n'est pas encore demandé : on retombe sur le nom du compte.
        displayName: request.user.name,
        role: request.user.role,
      },
      onboardingCompleted: profile !== null,
      activity: {
        activeOrders,
        inTransit: countFor(IN_TRANSIT_STAGES),
        readyForPickup: countFor(READY_STAGES),
        delivered,
      },
      urgentOrder: urgentOrder
        ? {
            reference: urgentOrder.reference,
            stage: urgentOrder.stage,
            stageLabel: SHIPMENT_STAGE_LABELS[urgentOrder.stage],
            nextStageLabel: nextStage ? SHIPMENT_STAGE_LABELS[nextStage] : null,
            progress: (SHIPMENT_STAGES.indexOf(urgentOrder.stage) + 1) / SHIPMENT_STAGES.length,
            totalXaf: urgentOrder.totalXaf,
            lastEvent: urgentOrder.events[0]
              ? {
                  description: urgentOrder.events[0].description,
                  occurredAt: urgentOrder.events[0].occurredAt.toISOString(),
                }
              : null,
            updatedAt: urgentOrder.updatedAt.toISOString(),
          }
        : null,
      nextAction: computeNextAction({
        onboardingCompleted: profile !== null,
        activeOrders,
        urgentStage: stage,
        deliveredOrdersWithoutSales: delivered,
      }),
      // Modules pas encore construits : on renvoie des listes vides plutôt que d'inventer (§54).
      opportunities: [],
      currentCourse: null,
      unreadNotifications: 0,
    };
  }
}
