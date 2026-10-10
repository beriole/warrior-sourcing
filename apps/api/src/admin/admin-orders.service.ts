import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
  canTransitionOrder,
  type AdminOrderDetailResponse,
  type AdminOrderListResponse,
  type AdminOrderResponse,
  type AdminOrderSearchQuery,
  type OrderStatus,
  type UpdateOrderStatusRequest,
} from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';

/** Colonnes communes à la liste et au détail. */
const RESUME = {
  id: true,
  reference: true,
  status: true,
  kind: true,
  stage: true,
  totalXaf: true,
  city: true,
  deliveryMode: true,
  createdAt: true,
  paidAt: true,
  user: { select: { name: true, email: true } },
  _count: { select: { lines: true } },
} as const;

type LigneCommande = {
  id: string;
  reference: string;
  status: OrderStatus;
  kind: 'STANDARD' | 'PREORDER';
  stage: AdminOrderResponse['stage'];
  totalXaf: number;
  city: string;
  deliveryMode: 'WAREHOUSE_PICKUP' | 'HOME_DELIVERY';
  createdAt: Date;
  paidAt: Date | null;
  user: { name: string; email: string };
  _count: { lines: number };
};

/**
 * Gestion des commandes côté back-office (ADM-06).
 * Le changement d'état suit une machine à états stricte, et chaque passage est journalisé.
 */
@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private format(row: LigneCommande): AdminOrderResponse {
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      kind: row.kind,
      stage: row.stage,
      totalXaf: row.totalXaf,
      city: row.city,
      deliveryMode: row.deliveryMode,
      customerName: row.user.name,
      customerEmail: row.user.email,
      lineCount: row._count.lines,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    };
  }

  async list(query: AdminOrderSearchQuery): Promise<AdminOrderListResponse> {
    const where = {
      ...(query.statut ? { status: query.statut } : {}),
      ...(query.genre ? { kind: query.genre } : {}),
      ...(query.recherche
        ? {
            OR: [
              { reference: { contains: query.recherche, mode: 'insensitive' as const } },
              { city: { contains: query.recherche, mode: 'insensitive' as const } },
              { user: { email: { contains: query.recherche, mode: 'insensitive' as const } } },
              { user: { name: { contains: query.recherche, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.taille,
        take: query.taille,
        select: RESUME,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders: rows.map((row) => this.format(row)),
      total,
      page: query.page,
      taille: query.taille,
    };
  }

  async detail(id: string): Promise<AdminOrderDetailResponse> {
    const commande = await this.prisma.order.findUnique({
      where: { id },
      select: {
        ...RESUME,
        subtotalXaf: true,
        freightXaf: true,
        serviceFeeXaf: true,
        customsXaf: true,
        phone: true,
        lines: {
          select: { id: true, label: true, quantity: true, unitPriceXaf: true, lineTotalXaf: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reference: true,
            method: true,
            status: true,
            amountXaf: true,
            refundedXaf: true,
            createdAt: true,
          },
        },
      },
    });
    if (!commande) throw new NotFoundException("Cette commande n'existe pas.");

    return {
      order: this.format(commande),
      amounts: {
        subtotalXaf: commande.subtotalXaf,
        freightXaf: commande.freightXaf,
        serviceFeeXaf: commande.serviceFeeXaf,
        customsXaf: commande.customsXaf,
        totalXaf: commande.totalXaf,
      },
      phone: commande.phone,
      lines: commande.lines,
      payments: commande.payments.map((paiement) => ({
        ...paiement,
        createdAt: paiement.createdAt.toISOString(),
      })),
      allowedStatuses: [...ORDER_STATUS_TRANSITIONS[commande.status]],
    };
  }

  /** Changement d'état encadré : toute transition non prévue est refusée et rien n'est écrit. */
  async changeStatus(
    id: string,
    input: UpdateOrderStatusRequest,
    actorId: string,
    ipAddress: string | null,
  ): Promise<AdminOrderDetailResponse> {
    const commande = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, reference: true, status: true },
    });
    if (!commande) throw new NotFoundException("Cette commande n'existe pas.");

    if (!canTransitionOrder(commande.status, input.status)) {
      const possibles = ORDER_STATUS_TRANSITIONS[commande.status];
      throw new BadRequestException(
        possibles.length
          ? `Une commande « ${ORDER_STATUS_LABELS[commande.status]} » ne peut passer qu'à : ${possibles
              .map((etat) => ORDER_STATUS_LABELS[etat])
              .join(', ')}.`
          : `Une commande « ${ORDER_STATUS_LABELS[commande.status]} » ne change plus d'état.`,
      );
    }

    await this.prisma.order.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.status === 'PAID' ? { paidAt: new Date() } : {}),
      },
    });

    await this.audit.record({
      actorId,
      action: 'order.status.changed',
      entity: 'order',
      entityId: id,
      metadata: {
        reference: commande.reference,
        from: commande.status,
        to: input.status,
        reason: input.reason,
      },
      ipAddress,
    });

    return this.detail(id);
  }
}
