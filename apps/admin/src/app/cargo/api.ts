/**
 * Appels API du back-office transitaires (CARGO-04).
 * La session voyage dans un cookie : toutes les requêtes passent les identifiants.
 * Les droits sont vérifiés par l'API (AuthGuard + @Roles) : cet écran ne fait que
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
