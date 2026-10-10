import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  type AdminIntegrationsResponse,
  type AdminPaymentListResponse,
  type AdminPaymentResponse,
  type AdminPaymentSearchQuery,
  type IntegrationStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '@ws/contracts';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

type LignePaiement = {
  reference: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amountXaf: number;
  refundedXaf: number;
  provider: string;
  providerRef: string | null;
  payerPhone: string | null;
  failureReason: string | null;
  orderId: string | null;
  serviceOrderId: string | null;
  lastCheckedAt: Date | null;
  paidAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  user: { name: string; email: string };
  order: { reference: string } | null;
};

/**
 * Paiements et état des intégrations, vus du back-office.
 *
 * Les paiements sont en **lecture seule**, et c'est une décision, pas un manque : leur
 * état vient de l'agrégateur, qui seul sait si l'argent est arrivé. Offrir un bouton
 * « marquer comme payé » serait offrir le moyen d'expédier une commande que personne n'a
 * réglée.
 */
@Injectable()
export class AdminPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private format(row: LignePaiement, referencePrestation: string | null): AdminPaymentResponse {
    return {
      reference: row.reference,
      status: row.status,
      statusLabel: PAYMENT_STATUS_LABELS[row.status],
      method: row.method,
      methodLabel: PAYMENT_METHOD_LABELS[row.method],
      amountXaf: row.amountXaf,
      refundedXaf: row.refundedXaf,
      provider: row.provider,
      providerRef: row.providerRef,
      payerPhone: row.payerPhone,
      failureReason: row.failureReason,
      customerName: row.user.name,
      customerEmail: row.user.email,
      target: row.order ? 'ORDER' : row.serviceOrderId ? 'SERVICE_ORDER' : 'NONE',
      targetReference: row.order?.reference ?? referencePrestation,
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
      paidAt: row.paidAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(query: AdminPaymentSearchQuery): Promise<AdminPaymentListResponse> {
    const where = {
      ...(query.statut ? { status: query.statut } : {}),
      ...(query.methode ? { method: query.methode } : {}),
      ...(query.recherche
        ? {
            OR: [
              { reference: { contains: query.recherche, mode: 'insensitive' as const } },
              { providerRef: { contains: query.recherche, mode: 'insensitive' as const } },
              { order: { reference: { contains: query.recherche, mode: 'insensitive' as const } } },
              { user: { name: { contains: query.recherche, mode: 'insensitive' as const } } },
              { user: { email: { contains: query.recherche, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [rows, total, groupes, encaisse, ouverts] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { user: { select: { name: true, email: true } }, order: { select: { reference: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.taille,
        take: query.taille,
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
      // Seuls les paiements confirmés comptent : un paiement en attente n'est pas de
      // l'argent, et l'afficher comme tel donnerait une recette imaginaire (§54).
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum: { amountXaf: true, refundedXaf: true },
      }),
      this.prisma.payment.count({ where: { status: { in: ['INITIATED', 'PENDING'] } } }),
    ]);

    // Les commandes de prestation ne sont pas liées par une relation Prisma : leur
    // référence se résout en une requête, pas une par ligne.
    const idsPrestations = rows.map((row) => row.serviceOrderId).filter((id): id is string => id !== null);
    const prestations = idsPrestations.length
      ? await this.prisma.serviceOrder.findMany({
          where: { id: { in: idsPrestations } },
          select: { id: true, reference: true },
        })
      : [];
    const referenceParId = new Map(prestations.map((item) => [item.id, item.reference]));

    return {
      page: query.page,
      taille: query.taille,
      total,
      items: rows.map((row) =>
        this.format(
          row as unknown as LignePaiement,
          row.serviceOrderId ? (referenceParId.get(row.serviceOrderId) ?? null) : null,
        ),
      ),
      byStatus: PAYMENT_STATUSES.map((status) => ({
        status,
        count: groupes.find((groupe) => groupe.status === status)?._count._all ?? 0,
      })),
      settledXaf: (encaisse._sum.amountXaf ?? 0) - (encaisse._sum.refundedXaf ?? 0),
      pendingCount: ouverts,
    };
  }

  /**
   * État des intégrations. Aucune valeur secrète n'en sort : on dit qu'une clé est
   * présente, jamais laquelle. Chaque manque est accompagné de ce qu'il entraîne, parce
   * qu'une liste de croix rouges sans conséquence n'aide personne à décider quoi régler.
   */
  integrations(): AdminIntegrationsResponse {
    const get = <K extends keyof Env>(key: K) => this.config.get(key, { infer: true });
    const rempli = (valeur: unknown) => typeof valeur === 'string' && valeur.length > 0;

    const sandbox = get('FAPSHI_ENV') !== 'live';
    const clesFapshi = sandbox
      ? rempli(get('FAPSHI_API_USER_SANDBOX') ?? get('FAPSHI_API_USER')) &&
        rempli(get('FAPSHI_API_KEY_SANDBOX') ?? get('FAPSHI_API_KEY'))
      : rempli(get('FAPSHI_API_USER')) && rempli(get('FAPSHI_API_KEY'));

    const items: IntegrationStatus[] = [
      {
        key: 'paiement',
        label: 'Encaissement Fapshi',
        health: clesFapshi ? 'OK' : 'MISSING',
        detail: clesFapshi
          ? `Clés présentes, environnement ${sandbox ? 'bac à sable' : 'production'}. Paiement direct sur le téléphone.`
          : 'Aucune clé API : l’agrégateur de test en mémoire prend le relais.',
        consequence: clesFapshi ? null : 'Aucun paiement réel ne peut être encaissé.',
      },
      {
        key: 'webhook',
        label: 'Secret du webhook de paiement',
        health: rempli(get('FAPSHI_WEBHOOK_SECRET')) ? 'OK' : 'DEGRADED',
        detail: rempli(get('FAPSHI_WEBHOOK_SECRET'))
          ? 'Secret configuré : les confirmations de l’agrégateur sont acceptées.'
          : 'Aucun secret configuré.',
        consequence: rempli(get('FAPSHI_WEBHOOK_SECRET'))
          ? null
          : 'Tous les webhooks sont rejetés. Un paiement n’est alors confirmé que par la relecture périodique, donc plus tard.',
      },
      {
        key: 'relecture',
        label: 'Relecture périodique des paiements',
        health: rempli(process.env.PAYMENTS_RECONCILE_INTERVAL_MS) ? 'OK' : 'DEGRADED',
        detail: rempli(process.env.PAYMENTS_RECONCILE_INTERVAL_MS)
          ? `Active, toutes les ${Math.round(Number(process.env.PAYMENTS_RECONCILE_INTERVAL_MS) / 1000)} s.`
          : 'Désactivée.',
        consequence: rempli(process.env.PAYMENTS_RECONCILE_INTERVAL_MS)
          ? null
          : 'Sans webhook ni relecture, un paiement confirmé chez l’agrégateur peut rester « en attente » chez nous.',
      },
      {
        key: 'email',
        label: 'Envoi des emails',
        health: rempli(get('RESEND_API_KEY')) || rempli(get('SMTP_HOST')) ? 'OK' : 'DEGRADED',
        detail: rempli(get('RESEND_API_KEY'))
          ? 'Resend configuré.'
          : rempli(get('SMTP_HOST'))
            ? 'Envoi SMTP configuré.'
            : 'Aucun transport : les emails sont écrits dans un dossier local.',
        consequence:
          rempli(get('RESEND_API_KEY')) || rempli(get('SMTP_HOST'))
            ? null
            : 'Les codes de connexion n’arrivent dans aucune boîte : ils sont seulement écrits dans les journaux du serveur.',
      },
      {
        key: 'fichiers',
        label: 'Stockage des fichiers (Cloudinary)',
        // Une seule variable porte tout l'accès : `CLOUDINARY_URL` (cloudinary://clé:secret@compte).
        health: rempli(get('CLOUDINARY_URL')) ? 'OK' : 'MISSING',
        detail: rempli(get('CLOUDINARY_URL'))
          ? 'Clés présentes : dépôt d’images et de vidéos possible.'
          : 'Aucune clé configurée.',
        consequence: rempli(get('CLOUDINARY_URL'))
          ? null
          : 'Aucun fichier ne peut être déposé : ni photo de produit, ni vidéo de formation, ni preuve d’inspection.',
      },
      {
        key: 'files',
        label: 'File de tâches',
        health: rempli(get('REDIS_URL')) ? 'OK' : 'DEGRADED',
        detail: rempli(get('REDIS_URL')) ? 'BullMQ sur Redis.' : 'File en mémoire.',
        consequence: rempli(get('REDIS_URL'))
          ? null
          : 'Les tâches planifiées ne survivent pas à un redémarrage du serveur.',
      },
    ];

    return { environment: String(get('NODE_ENV')), items };
  }
}
