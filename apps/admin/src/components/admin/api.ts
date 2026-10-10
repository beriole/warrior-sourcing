/**
 * Appels API du back-office (lot ADM).
 * La session voyage dans un cookie : toutes les requêtes passent les identifiants.
 * Les droits sont vérifiés par l'API (AuthGuard + @Roles) : ces écrans ne font que
 * présenter ce que le serveur autorise déjà.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ErreurApi extends Error {
  constructor(
    message: string,
    readonly statut: number,
  ) {
    super(message);
    this.name = 'ErreurApi';
  }
}

export async function appelApi<T>(chemin: string, init?: RequestInit): Promise<T> {
  const reponse = await fetch(`${API_URL}/v1${chemin}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!reponse.ok) {
    const corps = (await reponse.json().catch(() => null)) as { message?: string } | null;
    throw new ErreurApi(
      corps?.message ?? 'La requête n’a pas abouti. Réessayez dans un instant.',
      reponse.status,
    );
  }

  return reponse.json() as Promise<T>;
}

/** État d'accès déduit du code HTTP renvoyé par le serveur. */
export type EtatAcces = 'ok' | 'non-connecte' | 'refuse';

export function etatDepuisErreur(erreur: unknown): EtatAcces | null {
  if (erreur instanceof ErreurApi && erreur.statut === 401) return 'non-connecte';
  if (erreur instanceof ErreurApi && erreur.statut === 403) return 'refuse';
  return null;
}

/** Montant en FCFA, prêt pour le composant Money de @ws/ui. */
export function xaf(amountMinor: number) {
  return { amountMinor, currency: 'XAF' as const };
}

export function dateCourte(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function dateHeure(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
