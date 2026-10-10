'use client';

import {
  COURSE_THEMES,
  COURSE_THEME_LABELS,
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  type CourseTheme,
} from '@ws/contracts';
import { Badge, Button, Card, Entree, GrilleAnimee, Skeleton } from '@ws/ui';
import { ArrowLeft, ChevronLeft, ChevronRight, Library, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  EMPTY_RESOURCE_FILTERS,
  countActiveFilters,
  useLibrary,
  type ResourceFilters,
} from './academy-client';
import { ResourceCardView } from './resource-card';

const PER_PAGE = 12;

/**
 * Bibliothèque de ressources (ACA-05) : PDF, guides, checklists, modèles, fiches pratiques.
 *
 * Recherche libre et filtres par nature et par thème. Les compteurs affichés à côté des
 * filtres sont ceux de la bibliothèque réelle : un type sans ressource n'affiche rien.
 */
export function LibraryView() {
  const [filters, setFilters] = useState<ResourceFilters>(EMPTY_RESOURCE_FILTERS);
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } = useLibrary({
    page,
    perPage: PER_PAGE,
    filters,
  });

  const activeFilters = countActiveFilters(filters);

  function changeFilters(next: ResourceFilters) {
    setFilters(next);
    setPage(1);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Link
        href="/academy"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Academy
      </Link>

      <header>
        <Entree geste="texte" as="h1" className="font-display text-2xl font-bold tracking-tight">
          Bibliothèque
        </Entree>
        <Entree geste="paragraphe" delai={0.06} as="p" className="mt-1 text-sm text-muted-foreground">
          Les documents à garder sous la main pendant une commande : checklists, modèles à remplir,
          guides et fiches pratiques. Certaines ressources sont fournies avec une formation et s’ouvrent
          avec elle.
        </Entree>
      </header>

      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Rechercher</span>
          <span className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={filters.search ?? ''}
              onChange={(event) => changeFilters({ ...filters, search: event.target.value || undefined })}
              placeholder="Par exemple « checklist » ou « incoterms »"
              className="min-h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-imperial"
            />
          </span>
        </label>

        <nav aria-label="Nature de la ressource" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex w-max gap-2">
            <li>
              <FilterChip
                selected={filters.type === undefined}
                onClick={() => changeFilters({ ...filters, type: undefined })}
              >
                Tout
              </FilterChip>
            </li>
            {RESOURCE_TYPES.map((type) => {
              const count = data?.types.find((entry) => entry.type === type)?.count ?? 0;
              return (
                <li key={type}>
                  <FilterChip
                    selected={filters.type === type}
                    onClick={() => changeFilters({ ...filters, type })}
                  >
                    {RESOURCE_TYPE_LABELS[type]}
                    {count > 0 && <span className="figures ml-1.5 text-xs font-normal opacity-70">{count}</span>}
                  </FilterChip>
                </li>
              );
            })}
          </ul>
        </nav>

        <label className="grid gap-1 text-sm sm:max-w-xs">
          <span className="font-medium">Thème</span>
          <select
            value={filters.theme ?? ''}
            onChange={(event) =>
              changeFilters({ ...filters, theme: (event.target.value || undefined) as CourseTheme | undefined })
            }
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-imperial"
          >
            <option value="">Tous les thèmes</option>
            {COURSE_THEMES.map((theme) => {
              const count = data?.themes.find((entry) => entry.theme === theme)?.count ?? 0;
              return (
                <option key={theme} value={theme}>
                  {COURSE_THEME_LABELS[theme]}
                  {count > 0 ? ` (${count})` : ''}
                </option>
              );
            })}
          </select>
        </label>

        {activeFilters > 0 && (
          <div className="flex items-center gap-2">
            <Badge tone="brand">
              {activeFilters} filtre{activeFilters > 1 ? 's' : ''} actif{activeFilters > 1 ? 's' : ''}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => changeFilters(EMPTY_RESOURCE_FILTERS)}>
              Effacer
            </Button>
          </div>
        )}
      </div>

      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <Card className="text-center">
          <h2 className="font-display text-lg font-bold">La bibliothèque n’a pas pu être chargée</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.'}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      ) : data.items.length === 0 ? (
        <Card className="flex flex-col items-start">
          <span className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
            <Library className="size-5" aria-hidden />
          </span>
          <h2 className="font-semibold">Aucune ressource ne correspond</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeFilters > 0
              ? 'Essayez un autre thème, une autre nature de document, ou un mot plus court.'
              : 'La bibliothèque se remplit au fil des formations publiées. Rien n’y est ajouté sans son fichier.'}
          </p>
          {activeFilters > 0 && (
            <Button className="mt-4" variant="outline" size="sm" onClick={() => changeFilters(EMPTY_RESOURCE_FILTERS)}>
              Effacer les filtres
            </Button>
          )}
        </Card>
      ) : (
        <>
          <p className="figures text-xs text-muted-foreground">
            {data.total} ressource{data.total > 1 ? 's' : ''} — page {data.page} sur {data.totalPages}
          </p>

          <div aria-busy={isPlaceholderData || undefined} className={isPlaceholderData ? 'opacity-60' : ''}>
            <GrilleAnimee
              signature={`${page}|${JSON.stringify(filters)}`}
              className="grid gap-3 sm:grid-cols-2"
            >
              {data.items.map((resource) => (
                <ResourceCardView key={resource.id} resource={resource} />
              ))}
            </GrilleAnimee>
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft aria-hidden />
                Précédent
              </Button>
              <span className="figures text-sm text-muted-foreground">
                {data.page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Suivant
                <ChevronRight aria-hidden />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
        selected
          ? 'border-transparent bg-night text-white'
          : 'border-border bg-surface text-foreground hover:bg-surface-muted'
      }`}
    >
      {children}
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      ))}
    </div>
  );
}
