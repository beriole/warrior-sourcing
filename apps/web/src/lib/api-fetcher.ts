import { API_URL } from './auth-client';

/** Forme d'erreur renvoyée par l'API (voir apps/api/src/common/error.filter.ts). */
export type ApiErrorBody = {
  message: string;
  code: string;
  issues?: { path: string; message: string }[];
  incidentId?: string;
};

/** Erreur typée : l'interface branche sur `code`, jamais sur le texte du message. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: { path: string; message: string }[];
  readonly incidentId?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.issues = body.issues;
    this.incidentId = body.incidentId;
  }
}

/**
 * Transport unique du client généré par Orval.
 * La session vit dans un cookie : chaque appel doit donc porter les identifiants.
 * Ce fichier est écrit à la main et vit hors du dossier généré, que la génération efface.
 */
export const apiRequest = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, {
      message: body?.message ?? 'La requête n’a pas abouti. Réessayez dans un instant.',
      code: body?.code ?? 'request_failed',
      issues: body?.issues,
      incidentId: body?.incidentId,
    });
  }

  // 204 et réponses vides : rien à analyser.
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return (await response.json()) as T;
};
