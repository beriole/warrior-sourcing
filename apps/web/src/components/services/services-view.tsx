'use client';

import { SERVICE_CATEGORY_LABELS, type ServiceCard as ServiceCardData } from '@ws/contracts';
import { Badge, Button, Card, GrilleAnimee, Money, Skeleton } from '@ws/ui';
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Clock,
  CreditCard,
  Handshake,
  type LucideIcon,
  MessageCircle,
  Package,
  RefreshCw,
  Search,
  ScanSearch,
  Ship,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { FavoriToggle } from '@/components/favoris/favoris-client';
import {
  EMPTY_SERVICE_FILTERS,
  useServiceCatalog,
  type ServiceFilters,
} from './services-client';

const PAGE_SIZE = 12;

/**
 * Catalogue des prestations (SRV-01, §29).
 *
 * Chaque carte dit le prix, le délai et ce que le client reçoit. Quand l'un des trois
 * n'existe pas, l'écran l'écrit — « sur devis », « délai non communiqué » — plutôt que de
 * laisser croire à un chiffre. C'est la règle §54 appliquée là où elle se voit le plus :
 * sur un tarif.
 */
export function ServicesView() {
  const [filters, setFilters] = useState<ServiceFilters>(EMPTY_SERVICE_FILTERS);
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } =
    useServiceCatalog({ page, perPage: PAGE_SIZE, filters });

  function changer(suivants: ServiceFilters) {
    setFilters(suivants);
    setPage(1);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Services</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce que notre équipe fait à votre place, en Chine comme au Cameroun. Chaque prestation annonce son
          prix, son délai, ses livrables et ce qu’elle ne couvre pas.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <span className="sr-only">Rechercher une prestation</span>
          <input
            value={recherche}
            placeholder="Inspection, négociation, transport…"
            onChange={(event) => setRecherche(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') changer({ ...filters, search: recherche || undefined });
            }}
            className="h-11 w-full rounded-md border border-border bg-surface pl-9 text-sm outline-none focus-visible:border-primary"
          />
        </label>
        <Button variant="outline" onClick={() => changer({ ...filters, search: recherche || undefined })}>
          Rechercher
        </Button>
        <label className="ml-auto inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.orderableOnly ?? false}
            onChange={(event) => changer({ ...filters, orderableOnly: event.target.checked || undefined })}
            className="size-4 rounded border-border"
          />
          Payables en ligne seulement
        </label>
      </div>

      {data && data.categories.length > 0 && (
        <nav aria-label="Catégories de prestations" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex w-max gap-2">
            <li>
              <button
                type="button"
                onClick={() => changer({ ...filters, category: undefined })}
                aria-current={filters.category === undefined ? 'true' : undefined}
                className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
                  filters.category === undefined
                    ? 'border-transparent bg-night text-white'
                    : 'border-border bg-surface hover:bg-surface-muted'
                }`}
              >
                Toutes
              </button>
            </li>
            {data.categories.map(({ category, label, count }) => (
              <li key={category}>
                <button
                  type="button"
                  onClick={() => changer({ ...filters, category })}
                  aria-current={filters.category === category ? 'true' : undefined}
                  className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
                    filters.category === category
                      ? 'border-transparent bg-night text-white'
                      : 'border-border bg-surface hover:bg-surface-muted'
                  }`}
                >
                  {label}
                  <span className="figures ml-1.5 text-xs font-normal opacity-70">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Card className="text-center">
          <h2 className="font-display text-lg font-bold">Les prestations n’ont pas pu être chargées</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.'}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      ) : data.items.length === 0 ? (
        <Card>
          <h2 className="font-semibold">Aucune prestation ne correspond</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Élargissez la recherche, ou retirez le filtre « payables en ligne ».
          </p>
        </Card>
      ) : (
        <>
          <p className="figures text-xs text-muted-foreground">
            {data.total} prestation{data.total > 1 ? 's' : ''} — page {data.page} sur {data.totalPages}
          </p>
          <div className={isPlaceholderData ? 'opacity-60' : ''} aria-busy={isPlaceholderData || undefined}>
            <GrilleAnimee
              signature={`${filters.category ?? 'tout'}|${filters.search ?? ''}|${filters.orderableOnly ?? false}|${page}`}
              className="grid gap-3 sm:grid-cols-2"
            >
              {data.items.map((service) => (
                <ServiceTuile key={service.id} service={service} />
              ))}
            </GrilleAnimee>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Chaque catégorie a son pictogramme et sa teinte.
 *
 * Une prestation ne se photographie pas : « vérification de fournisseur » n'a pas d'image,
 * et en coller une de banque d'images reviendrait à illustrer un service par une scène qui
 * n'a jamais eu lieu. Un bandeau coloré avec un signe clair fait le travail que fait une
 * photo sur un produit : donner un point d'entrée à l'œil et distinguer deux cartes voisines.
 */
const CATEGORIES: Record<ServiceCardData['category'], { icone: LucideIcon; teinte: string }> = {
  SUPPLIER_SEARCH: { icone: Search, teinte: 'from-imperial/15 to-imperial/5 text-imperial' },
  VERIFICATION: { icone: BadgeCheck, teinte: 'from-success/15 to-success/5 text-success' },
  INSPECTION: { icone: ScanSearch, teinte: 'from-gold/20 to-gold/5 text-gold-ink' },
  NEGOTIATION: { icone: Handshake, teinte: 'from-night/15 to-night/5 text-night' },
  ASSISTED_PURCHASE: { icone: ShoppingCart, teinte: 'from-imperial/15 to-imperial/5 text-imperial' },
  SUPPLIER_PAYMENT: { icone: CreditCard, teinte: 'from-success/15 to-success/5 text-success' },
  CONSOLIDATION: { icone: Boxes, teinte: 'from-gold/20 to-gold/5 text-gold-ink' },
  SHIPPING: { icone: Ship, teinte: 'from-night/15 to-night/5 text-night' },
  BRANDING: { icone: Sparkles, teinte: 'from-gold/20 to-gold/5 text-gold-ink' },
  COACHING: { icone: MessageCircle, teinte: 'from-imperial/15 to-imperial/5 text-imperial' },
};

/**
 * Carte d'une prestation (SRV-01, §29).
 *
 * Le tarif passe en grand, parce que c'est l'information qu'on vient chercher. Le délai le
 * suit sur la même ligne. Le résumé reste, borné à deux lignes : au-delà, c'est la fiche
 * qui explique.
 *
 * Ce qui ne bouge pas (§54) : quand le prix n'existe pas, la carte écrit « Sur devis », et
 * quand le délai n'est pas annoncé, elle le dit. Aucun des deux n'est remplacé par un
 * chiffre plausible.
 */
function ServiceTuile({ service }: { service: ServiceCardData }) {
  const { icone: Icone, teinte } = CATEGORIES[service.category] ?? {
    icone: Package,
    teinte: 'from-surface-muted to-surface-muted text-muted-foreground',
  };

  return (
    <Card className="group flex h-full flex-col overflow-hidden p-0 transition-shadow duration-200 hover:shadow-lg">
      <div className={`relative flex h-28 items-center justify-center bg-gradient-to-br ${teinte}`}>
        <Icone className="size-10 transition-transform duration-500 ease-out group-hover:scale-110" aria-hidden />
        <span className="absolute top-2 right-1">
          <FavoriToggle targetType="SERVICE" targetId={service.id} libelle="cette prestation" />
        </span>
        {service.orderable && (
          <span className="absolute bottom-2 left-2.5">
            <Badge tone="success">Payable en ligne</Badge>
          </span>
        )}
      </div>

      <Link
        href={`/services/${service.slug}`}
        className="flex flex-1 flex-col gap-1 p-4 focus-visible:ring-2 focus-visible:ring-imperial focus-visible:outline-none"
      >
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {SERVICE_CATEGORY_LABELS[service.category].label}
        </p>
        <h2 className="line-clamp-2 min-h-[2.75rem] leading-snug font-semibold">{service.name}</h2>
        <p className="line-clamp-2 text-sm text-muted-foreground">{service.summary}</p>

        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-3">
          <span>
            {service.priceXaf === null ? (
              <span className="text-base font-semibold text-muted-foreground">Sur devis</span>
            ) : (
              <>
                {service.pricingMode === 'FROM' && (
                  <span className="mr-1 text-xs font-normal text-muted-foreground">dès</span>
                )}
                <Money
                  className="font-display text-xl font-bold tracking-tight"
                  value={{ amountMinor: service.priceXaf, currency: 'XAF' }}
                />
              </>
            )}
          </span>
          <span className="figures inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            {service.leadTimeLabel}
          </span>
        </div>
      </Link>
    </Card>
  );
}
