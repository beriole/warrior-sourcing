'use client';

import { useQuery } from '@tanstack/react-query';
import type { GlobalSearchResponse, SearchEntityType } from '@ws/contracts';
import { Badge, Button, Card, GrilleAnimee, Skeleton } from '@ws/ui';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiRequest } from '@/lib/api-fetcher';

/**
 * Recherche globale (PLAT-08, §36).
 *
 * La recherche tolère les fautes et les accents manquants : c'est le serveur qui mesure la
 * ressemblance. L'écran n'en dit rien — personne n'a envie de lire qu'il a mal tapé — mais
 * il affiche la famille de chaque résultat, pour qu'on sache ce qu'on ouvre.
 */
export function RechercheView({ initial }: { initial: string }) {
  const router = useRouter();
  const [saisie, setSaisie] = useState(initial);
  const [famille, setFamille] = useState<SearchEntityType | null>(null);

  const terme = initial.trim();
  const { data, isPending, isError, error } = useQuery<GlobalSearchResponse>({
    queryKey: ['recherche', terme],
    queryFn: ({ signal }) =>
      apiRequest<GlobalSearchResponse>(`/v1/recherche?q=${encodeURIComponent(terme)}&limit=40`, { signal }),
    enabled: terme.length >= 2,
  });

  const visibles = data?.items.filter((item) => famille === null || item.type === famille) ?? [];

  function lancer() {
    const propre = saisie.trim();
    if (propre.length >= 2) router.push(`/recherche?q=${encodeURIComponent(propre)}`);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Recherche</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Produits, fournisseurs, formations et prestations, en une seule recherche.
        </p>
      </header>

      <div className="flex gap-2">
        <label className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <span className="sr-only">Que cherchez-vous ?</span>
          <input
            value={saisie}
            autoFocus
            placeholder="Téléphone, inspection, douane…"
            onChange={(event) => setSaisie(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') lancer();
            }}
            className="h-11 w-full rounded-md border border-border bg-surface pl-9 text-sm outline-none focus-visible:border-primary"
          />
        </label>
        <Button onClick={lancer} disabled={saisie.trim().length < 2}>
          Rechercher
        </Button>
      </div>

      {terme.length < 2 ? (
        <Card>
          <h2 className="font-semibold">Tapez au moins deux lettres</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Les accents ne comptent pas, et une faute de frappe ne vous fera pas manquer un résultat.
          </p>
        </Card>
      ) : isPending ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Card className="text-center">
          <h2 className="font-display text-lg font-bold">La recherche n’a pas abouti</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.'}
          </p>
        </Card>
      ) : data.total === 0 ? (
        <Card>
          <h2 className="font-semibold">Rien ne correspond à « {terme} »</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Essayez un mot plus courant, ou parcourez les opportunités et les prestations.
          </p>
        </Card>
      ) : (
        <>
          {data.counts.length > 1 && (
            <nav aria-label="Familles de résultats" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <ul className="flex w-max gap-2">
                <li>
                  <button type="button" onClick={() => setFamille(null)} className={onglet(famille === null)}>
                    Tout
                    <span className="figures ml-1.5 text-xs font-normal opacity-70">{data.total}</span>
                  </button>
                </li>
                {data.counts.map(({ type, label, count }) => (
                  <li key={type}>
                    <button type="button" onClick={() => setFamille(type)} className={onglet(famille === type)}>
                      {label}
                      <span className="figures ml-1.5 text-xs font-normal opacity-70">{count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <GrilleAnimee signature={`${terme}-${famille ?? 'tout'}`} className="grid gap-2">
            {visibles.map((resultat) => (
              <Card key={`${resultat.type}-${resultat.id}`} className="p-0">
                <Link
                  href={resultat.href}
                  className="grid gap-1 rounded-lg p-4 focus-visible:ring-2 focus-visible:ring-imperial focus-visible:outline-none"
                >
                  {/* `justify-self-start` : dans une grille, la pastille s'étirerait
                      sur toute la largeur de la colonne. */}
                  <Badge tone="neutral" className="justify-self-start">
                    {resultat.typeLabel}
                  </Badge>
                  <span className="font-semibold leading-tight">{resultat.title}</span>
                  {resultat.subtitle && (
                    <span className="line-clamp-2 text-sm text-muted-foreground">{resultat.subtitle}</span>
                  )}
                </Link>
              </Card>
            ))}
          </GrilleAnimee>
        </>
      )}
    </div>
  );
}

function onglet(actif: boolean): string {
  return `min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
    actif
      ? 'border-transparent bg-night text-white'
      : 'border-border bg-surface text-foreground hover:bg-surface-muted'
  }`;
}
