/**
 * Lecture publique de l'API depuis un composant serveur.
 *
 * Deux choix assumés :
 *
 * 1. **Jamais d'exception.** Une section de la page d'accueil qui n'a pas ses données
 *    disparaît ; elle n'emporte pas la page avec elle. Une vitrine indisponible parce
 *    que l'API tousse est le pire moment pour être indisponible.
 * 2. **Aucun cookie transmis.** Ces appels servent le contenu public, identique pour
 *    tout le monde, et peuvent donc être mis en cache. Transmettre une session ici
 *    rendrait la page d'accueil personnalisée et inmémorisable sans que personne
 *    ne l'ait demandé.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function fetchPublic<T>(path: string, revalidate = 120): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
