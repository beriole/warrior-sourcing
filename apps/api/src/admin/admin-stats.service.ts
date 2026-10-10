import { Injectable } from '@nestjs/common';
import {
  ADMIN_PERIOD_DAYS,
  PAYMENT_STATUSES,
  type AdminPeriod,
  type AdminStatsResponse,
} from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';

/** Paiements considérés comme encaissés : ils ont donné lieu à un mouvement réel. */
const ENCAISSES = ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const;

/** Comptes considérés comme clients (§40 : le reste est de l'équipe interne). */
const ROLES_CLIENT = ['CLIENT', 'PREMIUM_MEMBER'] as const;

/**
 * Indicateurs du back-office (ADM-02, §37).
 *
 * Tout est agrégé par la base : aucune somme n'est recalculée en mémoire, aucun chiffre
 * n'est estimé. Une période sans donnée renvoie zéro, jamais une projection.
 */
@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Début de la fenêtre observée, ou null quand la période couvre tout l'historique. */
  private debut(period: AdminPeriod): Date | null {
    const jours = ADMIN_PERIOD_DAYS[period];
    if (jours === null) return null;
    const debut = new Date();
    debut.setUTCDate(debut.getUTCDate() - jours);
    return debut;
  }

  async stats(period: AdminPeriod): Promise<AdminStatsResponse> {
    const since = this.debut(period);
    const depuis = since ? { gte: since } : undefined;

    const [
      encaissements,
      commandesParEtat,
      commandesPayees,
      nouveauxComptes,
      acheteursActifs,
      totalComptes,
      paiementsParEtat,
      precommandes,
      campagnesOuvertes,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: { in: [...ENCAISSES] }, paidAt: since ? { gte: since } : { not: null } },
        _sum: { amountXaf: true, refundedXaf: true },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: depuis ? { createdAt: depuis } : {},
        _count: { _all: true },
      }),
      this.prisma.order.aggregate({
        where: { status: 'PAID', ...(depuis ? { createdAt: depuis } : {}) },
        _sum: { totalXaf: true },
      }),
      this.prisma.user.count({
        where: { role: { in: [...ROLES_CLIENT] }, ...(depuis ? { createdAt: depuis } : {}) },
      }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: depuis ? { createdAt: depuis } : {},
      }),
      this.prisma.user.count({ where: { role: { in: [...ROLES_CLIENT] } } }),
      this.prisma.payment.groupBy({
        by: ['status'],
        where: depuis ? { createdAt: depuis } : {},
        _count: { _all: true },
        _sum: { amountXaf: true },
      }),
      this.prisma.order.aggregate({
        where: { kind: 'PREORDER', ...(depuis ? { createdAt: depuis } : {}) },
        _count: { _all: true },
        _sum: { totalXaf: true },
      }),
      this.prisma.preorderCampaign.count({ where: { status: 'OPEN' } }),
    ]);

    const parEtat = (statut: string) =>
      commandesParEtat.find((ligne) => ligne.status === statut)?._count._all ?? 0;

    const grossXaf = encaissements._sum.amountXaf ?? 0;
    const refundedXaf = encaissements._sum.refundedXaf ?? 0;

    return {
      provenance: 'VERIFIED',
      period,
      since: since ? since.toISOString() : null,
      computedAt: new Date().toISOString(),
      revenue: {
        grossXaf,
        refundedXaf,
        netXaf: grossXaf - refundedXaf,
        paymentCount: encaissements._count._all,
      },
      orders: {
        total: commandesParEtat.reduce((somme, ligne) => somme + ligne._count._all, 0),
        pendingPayment: parEtat('PENDING_PAYMENT'),
        paid: parEtat('PAID'),
        cancelled: parEtat('CANCELLED'),
        paidAmountXaf: commandesPayees._sum.totalXaf ?? 0,
      },
      customers: {
        newAccounts: nouveauxComptes,
        activeBuyers: acheteursActifs.length,
        totalAccounts: totalComptes,
      },
      payments: {
        // Un état par valeur de l'énumération : un état sans paiement vaut zéro, il ne disparaît pas.
        byStatus: PAYMENT_STATUSES.map((status) => {
          const ligne = paiementsParEtat.find((item) => item.status === status);
          return {
            status,
            count: ligne?._count._all ?? 0,
            amountXaf: ligne?._sum.amountXaf ?? 0,
          };
        }),
      },
      preorders: {
        participations: precommandes._count._all,
        participationAmountXaf: precommandes._sum.totalXaf ?? 0,
        openCampaigns: campagnesOuvertes,
      },
    };
  }
}
