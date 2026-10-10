'use client';

import { FAVORITE_TARGET_TYPE_LABELS, type FavoriteTargetType } from '@ws/contracts';
import { Badge, Button, Card, GrilleAnimee, Skeleton } from '@ws/ui';
import { ArrowRight, Bookmark, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { FavoriToggle, useFavorites } from './favoris-client';

/**
 * Mes favoris (PLAT-09, §36).
 *
 * Les familles proposées en onglet sont celles qui contiennent réellement quelque chose :
 * un onglet « Formations (0) » n'apprend rien et donne l'impression d'un écran vide.
 */
export function FavorisView() {
  const [famille, setFamille] = useState<FavoriteTargetType | null>(null);
  const { data, isPending, isError, error, refetch, isRefetching } = useFavorites();

  const visibles = data?.items.filter((item) => famille === null || item.targetType === famille) ?? [];

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Mes favoris</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les produits, fournisseurs, formations et prestations que vous avez mis de côté.
        </p>
      </header>

      {isPending ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Card className="text-center">
          <h2 className="font-display text-lg font-bold">Vos favoris n’ont pas pu être chargés</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Connectez-vous pour retrouver vos favoris.'}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      ) : data.total === 0 ? (
        <Card className="flex flex-col items-start">
          <span className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
            <Bookmark className="size-5" aria-hidden />
          </span>
          <h2 className="font-semibold">Rien de mis de côté pour l’instant</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Le marque-page présent sur chaque fiche la range ici : pratique pour comparer deux produits ou
            garder une prestation sous la main.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/opportunites">
              Parcourir les opportunités
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </Card>
      ) : (
        <>
          {data.counts.length > 1 && (
            <nav aria-label="Familles de favoris" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <ul className="flex w-max gap-2">
                <li>
                  <button
                    type="button"
                    onClick={() => setFamille(null)}
                    aria-current={famille === null ? 'true' : undefined}
                    className={onglet(famille === null)}
                  >
                    Tout
                    <span className="figures ml-1.5 text-xs font-normal opacity-70">{data.total}</span>
                  </button>
                </li>
                {data.counts.map(({ type, label, count }) => (
                  <li key={type}>
                    <button
                      type="button"
                      onClick={() => setFamille(type)}
                      aria-current={famille === type ? 'true' : undefined}
                      className={onglet(famille === type)}
                    >
                      {label}
                      <span className="figures ml-1.5 text-xs font-normal opacity-70">{count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <GrilleAnimee signature={`favoris-${famille ?? 'tout'}-${visibles.length}`} className="grid gap-3">
            {visibles.map((favori) => (
              <Card key={`${favori.targetType}-${favori.targetId}`} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <Badge tone="neutral">{FAVORITE_TARGET_TYPE_LABELS[favori.targetType].label}</Badge>
                  <h2 className="mt-1.5 font-semibold leading-tight">
                    <Link href={favori.href} className="hover:underline">
                      {favori.title}
                    </Link>
                  </h2>
                  {favori.subtitle && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{favori.subtitle}</p>
                  )}
                </div>
                <FavoriToggle
                  targetType={favori.targetType}
                  targetId={favori.targetId}
                  libelle={`« ${favori.title} »`}
                />
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
