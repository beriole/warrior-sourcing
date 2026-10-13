'use client';

import { Skeleton } from '@ws/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';

/**
 * Écrans qui demandent une session. Tout le reste de `(app)` reste public : le
 * catalogue, l'Academy, les fournisseurs, le calculateur et l'aide se consultent sans
 * compte, et c'est voulu — on ne demande pas de s'inscrire pour regarder.
 *
 * La liste est un préfixe de chemin, pas une correspondance exacte : `/importations/abc`
 * est protégé parce que `/importations` l'est.
 */
const PRIVES = [
  '/tableau-de-bord',
  '/importations',
  '/favoris',
  '/messages',
  '/profil',
  '/parametres',
  '/business-lab',
] as const;

export function estPrive(chemin: string): boolean {
  return PRIVES.some((prefixe) => chemin === prefixe || chemin.startsWith(`${prefixe}/`));
}

/**
 * Garde de session (§10).
 *
 * ## Pourquoi côté client, et pas dans un `middleware`
 *
 * La session vit dans un cookie posé par l'API, sur **son** domaine. Le site est servi
 * depuis un autre domaine : un `middleware` Next, qui ne lit que les cookies de son propre
 * domaine, ne verrait jamais cette session et renverrait tout le monde vers la connexion,
 * y compris les gens connectés. Tant que l'API n'est pas servie sur un sous-domaine du
 * site, la vérification ne peut avoir lieu qu'ici, dans le navigateur, en interrogeant
 * l'API avec les identifiants.
 *
 * ## Ce que ça remplace
 *
 * Avant, chaque écran se débrouillait : le tableau de bord appelait son point d'entrée et,
 * **s'il recevait un 401**, renvoyait vers la connexion. Deux défauts. D'abord l'écran
 * s'affichait avant de disparaître. Ensuite, quand l'appel échouait pour une autre raison
 * qu'un 401 — une liste blanche CORS inexacte, par exemple —, il n'y avait pas de 401 du
 * tout : la page restait là, avec un message d'erreur, et donnait l'impression qu'on peut
 * se promener dans son espace sans compte.
 *
 * Ici, c'est l'absence de session qui décide, pas le code d'erreur d'un appel métier.
 */
export function GardeConnexion({ children }: { children: ReactNode }) {
  const chemin = usePathname();
  const router = useRouter();
  const { data, isPending } = authClient.useSession();

  const protege = estPrive(chemin);
  const refuse = protege && !isPending && !data?.session;

  useEffect(() => {
    if (!refuse) return;
    // `suite` ramène la personne là où elle allait, une fois connectée.
    router.replace(`/connexion?suite=${encodeURIComponent(chemin)}`);
  }, [refuse, chemin, router]);

  if (!protege) return <>{children}</>;

  // Pendant la vérification — et pendant la redirection, qui n'est pas instantanée — on
  // montre la forme de l'écran plutôt que son contenu. Afficher le contenu puis le retirer
  // laisserait entrevoir des informations à quelqu'un qui n'y a pas droit.
  if (isPending || refuse) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8" aria-busy="true">
        <span className="sr-only">
          {refuse ? 'Session absente : redirection vers la connexion.' : 'Vérification de votre session…'}
        </span>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-80" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
