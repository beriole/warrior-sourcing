import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Client d'authentification. L'API porte la session dans un cookie :
 * toutes les requêtes doivent donc être faites avec les identifiants.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/v1/auth',
  fetchOptions: { credentials: 'include' },
  plugins: [emailOTPClient()],
});

/** Appel authentifié vers l'API métier (hors routes Better Auth). */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'La requête n’a pas abouti. Réessayez dans un instant.');
  }

  return response.json() as Promise<T>;
}
