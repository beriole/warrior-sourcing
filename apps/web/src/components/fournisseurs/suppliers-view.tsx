'use client';

import {
  INTEREST_CATEGORIES,
  INTEREST_CATEGORY_LABELS,
  SUPPLIER_VERIFICATION_LABELS,
  SUPPLIER_VERIFICATION_LEVELS,
  SUPPLIER_TYPES,
  type SupplierCard as SupplierCardData,
} from '@ws/contracts';
import { Badge, Button, Card, GrilleAnimee, Skeleton, VerificationBadge } from '@ws/ui';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Factory, Filter, RefreshCw, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FavoriToggle } from '@/components/favoris/favoris-client';
import {
  EMPTY_FILTERS,
  countActiveFilters,
  fetchSuppliers,
  formatDate,
  type SupplierFilters,
} from './api';

const PAGE_SIZE = 12;

const TYPE_LABELS: Record<(typeof SUPPLIER_TYPES)[number], string> = {
  MANUFACTURER: 'Usine',
  DISTRIBUTOR: 'Distributeur',
  TRADING_COMPANY: 'Société de négoce',
};

/**
 * Liste des fournisseurs et filtres (§15, SUP-03, SUP-05).
 * Mobile d'abord : les filtres se replient, la liste tient sur une colonne.
 */
export function SuppliersView() {
  const [filters, setFilters] = useState<SupplierFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['fournisseurs', filters, page],
    queryFn: () => fetchSuppliers(filters, page, PAGE_SIZE),
    retry: false,
  });

  const activeFilters = useMemo(() => countActiveFilters(filters), [filters]);
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function update(patch: Partial<SupplierFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Fournisseurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque badge affiché repose sur une preuve enregistrée et datée. Les incidents connus restent visibles,
          même chez un fournisseur partenaire.
        </p>
      </header>

      <Card className="grid gap-3">
        <label className="relative block">
          <span className="sr-only">Rechercher un fournisseur ou un produit</span>
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={filters.q}
            onChange={(event) => update({ q: event.target.value })}
            placeholder="Nom du fournisseur ou produit (coque, bouilloire…)"
            className="min-h-11 w-full rounded-md border border-border bg-surface pr-3 pl-9 text-sm"
          />
        </label>

        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPanelOpen((open) => !open)}>
            <Filter aria-hidden />
            Filtres
            {activeFilters > 0 && <Badge tone="brand">{activeFilters}</Badge>}
          </Button>
          {activeFilters > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({ ...EMPTY_FILTERS, q: filters.q });
                setPage(1);
              }}
            >
              <X aria-hidden />
              Tout effacer
            </Button>
          )}
        </div>

        {panelOpen && (
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <Field label="Catégorie">
              <select
                value={filters.category}
                onChange={(event) => update({ category: event.target.value as SupplierFilters['category'] })}
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
              >
                <option value="">Toutes les catégories</option>
                {INTEREST_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {INTEREST_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ville">
              <select
                value={filters.city}
                onChange={(event) => update({ city: event.target.value })}
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
              >
                <option value="">Toutes les villes</option>
                {(data?.availableCities ?? []).map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Type de fournisseur">
              <select
                value={filters.type}
                onChange={(event) => update({ type: event.target.value as SupplierFilters['type'] })}
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
              >
                <option value="">Tous les types</option>
                {SUPPLIER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Quantité minimale de commande (au plus)">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={filters.moqMax}
                onChange={(event) => update({ moqMax: event.target.value })}
                placeholder="Exemple : 300 pièces"
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
              />
            </Field>

            <Field label="Niveau de vérification minimal">
              <select
                value={filters.minLevel}
                onChange={(event) => update({ minLevel: event.target.value as SupplierFilters['minLevel'] })}
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
              >
                <option value="">Tous les fournisseurs</option>
                {SUPPLIER_VERIFICATION_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {SUPPLIER_VERIFICATION_LABELS[level].label}
                  </option>
                ))}
              </select>
            </Field>

            <fieldset className="grid content-end gap-2">
              <legend className="mb-1 text-xs font-medium text-muted-foreground">Conditions</legend>
              <Check
                label="Personnalisation possible (logo, marque)"
                checked={filters.customization}
                onChange={(checked) => update({ customization: checked })}
              />
              <Check
                label="Échantillon disponible"
                checked={filters.sample}
                onChange={(checked) => update({ sample: checked })}
              />
            </fieldset>
          </div>
        )}
      </Card>

      {isPending && <ListSkeleton />}

      {isError && (
        <Card className="text-center">
          <h2 className="font-display text-lg font-bold">La liste n’a pas pu être chargée</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Une erreur inattendue s'est produite."}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      )}

      {data && (
        <>
          <p className="figures text-sm text-muted-foreground">
            {data.total === 0
              ? 'Aucun fournisseur ne correspond'
              : `${data.total} fournisseur${data.total > 1 ? 's' : ''} correspondent`}
          </p>

          {data.items.length === 0 ? (
            <Card className="flex flex-col items-start">
              <span className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
                <Factory className="size-5" aria-hidden />
              </span>
              <h2 className="font-semibold">Aucun fournisseur ne correspond à cette recherche</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Nous n’affichons un fournisseur qu’une fois ses informations contrôlées. Élargissez les filtres, ou
                demandez un sourcing : notre équipe cherche le fournisseur à votre place.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setPage(1);
                }}
              >
                Effacer les filtres
              </Button>
            </Card>
          ) : (
            <GrilleAnimee
              signature={`${page}|${JSON.stringify(filters)}`}
              className="grid gap-3 lg:grid-cols-2"
            >
              {data.items.map((supplier) => (
                <SupplierCard key={supplier.id} supplier={supplier} />
              ))}
            </GrilleAnimee>
          )}

          {lastPage > 1 && (
            <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Précédents
              </Button>
              <span className="figures text-sm text-muted-foreground">
                Page {page} sur {lastPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= lastPage}
                onClick={() => setPage((current) => current + 1)}
              >
                Suivants
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

/** Carte compacte : ce qui permet de décider d'ouvrir la fiche, rien de plus (§44). */
function SupplierCard({ supplier }: { supplier: SupplierCardData }) {
  const verifiedOn = formatDate(supplier.verification?.verifiedAt ?? null);

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <VisuelFournisseur nom={supplier.name} url={supplier.logoUrl} />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold leading-tight">{supplier.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {supplier.typeLabel} · {supplier.city}
            </p>
          </div>
          <FavoriToggle targetType="SUPPLIER" targetId={supplier.id} libelle="ce fournisseur" className="-mt-2" />
        </div>
        {/* Sans preuve enregistrée, aucun badge : l'absence est dite en toutes lettres (§16). */}
        {supplier.verification ? (
          <VerificationBadge
            level={supplier.verification.level}
            verifiedAt={new Date(supplier.verification.verifiedAt)}
          />
        ) : (
          <Badge tone="neutral" title="Aucune preuve n’a encore été enregistrée pour ce fournisseur.">
            Non vérifié
          </Badge>
        )}
      </div>

      {supplier.verification && verifiedOn && (
        <p className="figures mt-1 text-xs text-muted-foreground">Vérifié le {verifiedOn}</p>
      )}

      {supplier.publicSummary && <p className="mt-2 text-sm">{supplier.publicSummary}</p>}

      {supplier.topOfferings.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">Produits : {supplier.topOfferings.join(', ')}</p>
      )}

      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">MOQ</dt>
          <dd className="figures font-semibold">{supplier.moq ?? 'Non communiqué'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Délai</dt>
          <dd className="figures font-semibold">
            {supplier.leadTimeDays ? `${supplier.leadTimeDays} j` : 'Non communiqué'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Échantillon</dt>
          <dd className="font-semibold">{supplier.sampleAvailable ? 'Oui' : 'Non'}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {supplier.customization && <Badge tone="brand">Personnalisation</Badge>}
        {supplier.categories.map((category) => (
          <Badge key={category} tone="neutral">
            {INTEREST_CATEGORY_LABELS[category]}
          </Badge>
        ))}
        {supplier.openIncidents > 0 && (
          <Badge tone="warning" title="Un incident ouvert est toujours affiché, même chez un fournisseur vérifié.">
            <AlertTriangle aria-hidden />
            {supplier.openIncidents} incident{supplier.openIncidents > 1 ? 's' : ''} en cours
          </Badge>
        )}
      </div>

      <div className="mt-auto pt-4">
        <Button asChild size="sm" variant="outline" block>
          <Link href={`/fournisseurs/${supplier.id}`}>
            Voir la fiche
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 rounded border-border"
      />
      {label}
    </label>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-52 rounded-lg" />
      ))}
    </div>
  );
}

/**
 * Visuel d'un fournisseur dans une liste.
 *
 * Sans image déposée, on montre les initiales sur un aplat — pas une photo d'usine prise
 * ailleurs, ni un pictogramme d'appareil photo barré. Une liste où chaque ligne a la même
 * illustration générique est moins lisible qu'une liste sans illustration du tout.
 */
function VisuelFournisseur({ nom, url }: { nom: string; url: string | null }) {
  if (!url) {
    const initiales = nom
      .split(/\s+/)
      .slice(0, 2)
      .map((mot) => mot[0]?.toUpperCase() ?? '')
      .join('');

    return (
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-muted text-sm font-bold text-muted-foreground"
      >
        {initiales}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- source distante, sans optimiseur
    <img
      src={url}
      alt=""
      loading="lazy"
      className="size-11 shrink-0 rounded-md border border-border object-cover"
    />
  );
}
