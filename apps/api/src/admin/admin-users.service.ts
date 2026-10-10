import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminUserListResponse,
  AdminUserResponse,
  AdminUserSearchQuery,
  UpdateUserRoleRequest,
  UpdateUserRoleResponse,
  UserRole,
} from '@ws/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';

type LigneUtilisateur = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  role: UserRole;
  emailVerified: boolean;
  createdAt: Date;
  _count: { orders: number };
};

/**
 * Comptes et rôles (ADM-07, §40).
 *
 * La lecture est ouverte à l'administration ; le changement de rôle est réservé au
 * SUPER_ADMIN par le contrôleur, et toujours journalisé dans `AuditLog`.
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private format(row: LigneUtilisateur): AdminUserResponse {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phoneNumber: row.phoneNumber,
      role: row.role,
      emailVerified: row.emailVerified,
      orderCount: row._count.orders,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(query: AdminUserSearchQuery): Promise<AdminUserListResponse> {
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.recherche
        ? {
            OR: [
              { name: { contains: query.recherche, mode: 'insensitive' as const } },
              { email: { contains: query.recherche, mode: 'insensitive' as const } },
              { phoneNumber: { contains: query.recherche } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.taille,
        take: query.taille,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: rows.map((row) => this.format(row)),
      total,
      page: query.page,
      taille: query.taille,
    };
  }

  /**
   * Changement de rôle. L'appelant est déjà SUPER_ADMIN (vérifié par le garde) :
   * il reste à refuser les cas qui bloqueraient l'administration elle-même.
   */
  async changeRole(
    targetId: string,
    input: UpdateUserRoleRequest,
    actor: { id: string; role: UserRole },
    ipAddress: string | null,
  ): Promise<UpdateUserRoleResponse> {
    const cible = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true, name: true, email: true },
    });
    if (!cible) throw new NotFoundException("Ce compte n'existe pas.");

    if (cible.id === actor.id) {
      throw new BadRequestException(
        'Vous ne pouvez pas modifier votre propre rôle. Demandez à un autre super-administrateur.',
      );
    }
    if (cible.role === input.role) {
      throw new BadRequestException('Ce compte a déjà ce rôle.');
    }

    const misAJour = await this.prisma.user.update({
      where: { id: targetId },
      data: { role: input.role },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    });

    // Journalisation systématique : qui, sur qui, d'où vers où, et pourquoi.
    await this.audit.record({
      actorId: actor.id,
      action: 'user.role.changed',
      entity: 'user',
      entityId: targetId,
      metadata: {
        email: cible.email,
        from: cible.role,
        to: input.role,
        reason: input.reason,
      },
      ipAddress,
    });

    return { user: this.format(misAJour), previousRole: cible.role };
  }
}
