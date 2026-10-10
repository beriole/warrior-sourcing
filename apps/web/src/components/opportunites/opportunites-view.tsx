'use client';

import {
  CATALOG_TABS,
  CATALOG_TAB_LABELS,
  INTEREST_CATEGORIES,
  INTEREST_CATEGORY_LABELS,
  RISK_LEVELS,
  RISK_LEVEL_LABELS,
  TRANSPORT_EASES,
  TRANSPORT_EASE_LABELS,
  type CatalogTab,
  type RiskLevel,
  type TransportEase,
} from '@ws/contracts';
import { Badge, Button, Card, GrilleAnimee, Skeleton } from '@ws/ui';
import { ChevronLeft, ChevronRight, Compass, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import {
  EMPTY_FILTERS,
  countActiveFilters,
  useCatalogList,
  type CatalogFilters,
} from './catalog-client';
import { ProductCard } from './product-card';

const PER_PAGE = 12;

/**
 * Écran Opportunités (§12).
 *
 * Six onglets, des filtres, et des cartes qui disent d'où vient chaque chiffre.
 * Mobile d'abord : une colonne, onglets défilants, zones tactiles d'au moins 44 px.
 */
export function OpportunitesView() {
  const [tab, setTab] = useState<CatalogTab>('FOR_YOU');
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } = useCatalogList({
    tab,
    page,
    perPage: PER_PAGE,
    filters,
  });

  const activeFilters = countActiveFilters(filters);

  function changeTab(next: CatalogTab) {
    setTab(next);
    setPage(1);
  }

  function changeFilters(next: CatalogFilters) {
    setFilters(next);
    setPage(1);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Opportunités</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Des produits à importer de Chine, avec le prix payé là-bas, le coût rendu au Cameroun et le prix
          réellement constaté ici. Les coûts sont des estimations : ils portent leur date et leurs hypothèses.
        </p>
      </header>

      <nav aria-label="Classement des opportunités" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2">
          {CATALOG_TABS.map((candidate) => {
            const selected = candidate === tab;
            return (
              <li key={candidate}>
                <button
                  type="button"
                  onClick={() => changeTab(candidate)}
                  aria-current={selected ? 'true' : undefined}
                  className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
                    selected
                      ? 'border-transparent bg-night text-white'
                      : 'border-border bg-surface text-foreground hover:bg-surface-muted'
                  }`}
                >
                  {CATALOG_TAB_LABELS[candidate].label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="text-sm text-muted-foreground">
        {data ? data.personalizationNote : CATALOG_TAB_LABELS[tab].description}
      </p>

      <FiltersPanel filters={filters} activeFilters={activeFilters} onChange={changeFilters} />

      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <Card className="text-center">
          <h2 className="font-display text-lg font-bold">Les opportunités n’ont pas pu être chargées</h2>
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
            <Compass className="size-5" aria-hidden />
          </span>
          <h2 className="font-semibold">Aucun produit ne correspond</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeFilters > 0
              ? 'Vos filtres sont peut-être trop stricts. Élargissez votre budget ou retirez un critère.'
              : 'Nous ne publions une opportunité que lorsque son prix d’achat, son coût rendu et ses points de vigilance ont été vérifiés. Revenez bientôt : le catalogue se remplit au fil des vérifications.'}
          </p>
          {activeFilters > 0 && (
            <Button className="mt-4" variant="outline" size="sm" onClick={() => changeFilters(EMPTY_FILTERS)}>
              Effacer les filtres
            </Button>
          )}
        </Card>
      ) : (
        <>
          <p className="figures text-xs text-muted-foreground">
            {data.total} produit{data.total > 1 ? 's' : ''} — page {data.page} sur {data.totalPages}
          </p>

          <div aria-busy={isPlaceholderData || undefined} className={isPlaceholderData ? 'opacity-60' : ''}>
            <GrilleAnimee
              signature={`${tab}|${page}|${JSON.stringify(filters)}`}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {data.items.map((product) => (
                <ProductCard key={product.id} product={product} />
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

/** Filtres repliés par défaut : l'écran reste lisible sur un téléphone d'entrée de gamme. */
function FiltersPanel({
  filters,
  activeFilters,
  onChange,
}: {
  filters: CatalogFilters;
  activeFilters: number;
  onChange: (filters: CatalogFilters) => void;
}) {
  const update = (patch: CatalogFilters) => onChange({ ...filters, ...patch });
  const toNumber = (value: string) => (value === '' ? undefined : Number(value));

  return (
    <details className="rounded-lg border border-border bg-surface shadow-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtrer
        {activeFilters > 0 && <Badge tone="brand">{activeFilters} actif{activeFilters > 1 ? 's' : ''}</Badge>}
      </summary>

      <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Budget disponible (FCFA)" hint="Écarte ce que la commande minimum dépasse">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={filters.budgetMaxXaf ?? ''}
            onChange={(event) => update({ budgetMaxXaf: toNumber(event.target.value) })}
            placeholder="Par exemple 300000"
            className={inputClass}
          />
        </Field>

        <Field label="Quantité minimum acceptée">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={filters.moqMax ?? ''}
            onChange={(event) => update({ moqMax: toNumber(event.target.value) })}
            placeholder="Par exemple 50 pièces"
            className={inputClass}
          />
        </Field>

        <Field label="Marge estimée minimum (%)">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={filters.marginMinPercent ?? ''}
            onChange={(event) => update({ marginMinPercent: toNumber(event.target.value) })}
            placeholder="Par exemple 40"
            className={inputClass}
          />
        </Field>

        <Field label="Poids maximum par pièce (g)">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={filters.weightMaxGrams ?? ''}
            onChange={(event) => update({ weightMaxGrams: toNumber(event.target.value) })}
            placeholder="Par exemple 500"
            className={inputClass}
          />
        </Field>

        <Field label="Catégorie">
          <select
            value={filters.category ?? ''}
            onChange={(event) => update({ category: event.target.value || undefined })}
            className={inputClass}
          >
            <option value="">Toutes les catégories</option>
            {INTEREST_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {INTEREST_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Risque maximum">
          <select
            value={filters.riskMax ?? ''}
            onChange={(event) => update({ riskMax: (event.target.value || undefined) as RiskLevel | undefined })}
            className={inputClass}
          >
            <option value="">Tous les niveaux relevés</option>
            {RISK_LEVELS.map((level) => (
              <option key={level} value={level}>
                {RISK_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Transport">
          <select
            value={filters.transportEase ?? ''}
            onChange={(event) =>
              update({ transportEase: (event.target.value || undefined) as TransportEase | undefined })
            }
            className={inputClass}
          >
            <option value="">Tous</option>
            {TRANSPORT_EASES.map((ease) => (
              <option key={ease} value={ease}>
                {TRANSPORT_EASE_LABELS[ease]}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-end">
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)} disabled={activeFilters === 0}>
            Effacer les filtres
          </Button>
        </div>
      </div>

      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        Les filtres portant sur la marge, le risque ou le transport ne retiennent que les produits pour lesquels
        la donnée a été relevée : un produit sans relevé n’est jamais supposé conforme.
      </p>
    </details>
  );
}

const inputClass =
  'min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-imperial';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
          <Skeleton className="aspect-4/3 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
