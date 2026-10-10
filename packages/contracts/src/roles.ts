import { z } from 'zod';

/** Cahier §40 : rôles. Les droits sont toujours vérifiés côté serveur. */
export const USER_ROLES = [
  'CLIENT',
  'PREMIUM_MEMBER',
  'TRAINER',
  'SOURCING_AGENT',
  'CHINA_AGENT',
  'LOGISTICS_AGENT',
  'SUPPORT',
  'CONTENT_MANAGER',
  'ADMIN',
  'SUPER_ADMIN',
] as const;
export const UserRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof UserRoleSchema>;

/** Le « Visiteur » du cahier n'est pas un rôle stocké : c'est l'absence de session. */
export const STAFF_ROLES: readonly UserRole[] = [
  'TRAINER',
  'SOURCING_AGENT',
  'CHINA_AGENT',
  'LOGISTICS_AGENT',
  'SUPPORT',
  'CONTENT_MANAGER',
  'ADMIN',
  'SUPER_ADMIN',
];

export function isStaff(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}
