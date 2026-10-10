import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isStaff, type UserRole } from '@ws/contracts';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { Auth } from './auth.config.js';
import { AUTH } from './auth.tokens.js';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean | null;
  role: UserRole;
};

export type AuthenticatedRequest = Request & { user: SessionUser };

const ROLES_KEY = 'ws:roles';

/** Restreint une route à certains rôles. Toujours combiné à AuthGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Restreint une route à l'équipe interne (tous rôles hors client). */
export const StaffOnly = () => SetMetadata(ROLES_KEY, 'STAFF');

/**
 * Vérifie la session Better Auth puis, le cas échéant, le rôle exigé.
 * Les droits sont donc contrôlés côté serveur (§40), jamais déduits de l'interface.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) {
      throw new UnauthorizedException('Vous devez être connecté pour accéder à cette page.');
    }

    request.user = session.user as SessionUser;

    const required = this.reflector.getAllAndOverride<UserRole[] | 'STAFF' | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const role = request.user.role;
    const allowed = required === 'STAFF' ? isStaff(role) : required.includes(role);
    if (!allowed) {
      throw new ForbiddenException("Votre compte n'a pas accès à cette fonctionnalité.");
    }

    return true;
  }
}
