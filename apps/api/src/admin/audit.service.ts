import { Injectable } from '@nestjs/common';
import type { AuditEntryResponse, AuditListResponse } from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';

/** Écriture d'une ligne d'audit (§39, §41). Toute action sensible passe par ici. */
export type AuditInput = {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

/**
 * Journal des actions sensibles du back-office.
 * Une ligne d'audit n'est jamais modifiée ni supprimée : elle constate, elle ne raconte pas.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        metadata: (input.metadata ?? undefined) as never,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  /** Dernières actions sensibles, avec le nom de leur auteur quand le compte existe encore. */
  async recent(limit = 20): Promise<AuditListResponse> {
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.auditLog.count(),
    ]);

    const actorIds = [...new Set(rows.map((row) => row.actorId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(actors.map((actor) => [actor.id, actor.name]));

    const entries: AuditEntryResponse[] = rows.map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      actorId: row.actorId,
      actorName: row.actorId ? (nameById.get(row.actorId) ?? null) : null,
      metadata:
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
      createdAt: row.createdAt.toISOString(),
    }));

    return { entries, total };
  }
}
