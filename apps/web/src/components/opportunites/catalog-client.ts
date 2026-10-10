'use client';

import type {
  CatalogListResponse,
  CatalogProductResponse,
  CatalogTab,
  InvestmentSimulationResponse,
  RiskLevel,
  TransportEase,
} from '@ws/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-fetcher';

/**
 * Accès aux routes du catalogue (lot CAT).
 *
 * Le client généré par Orval ne couvre pas encore ces routes : il est reconstruit par
 * `pnpm generate:api`, qui écrit dans des fichiers partagés avec les autres lots.
 * En attendant cette régénération, les appels passent par le même transport
 * (`apiRequest`) et sont typés avec les schémas de `@ws/contracts` : le contrat reste unique.
 */

/** Filtres de l'écran, tels que l'utilisateur les manipule. */
export interface CatalogFilters {
  budgetMaxXaf?: number;
  moqMax?: number;
  marginMinPercent?: number;
  riskMax?: RiskLevel;
  weightMaxGrams?: number;
  category?: string;
  transportEase?: TransportEase;
}

export const EMPTY_FILTERS: CatalogFilters = {};

export function countActiveFilters(filters: CatalogFilters): number {
  return Object.values(filters).filter((value) => value !== undefined && value !== '').length;
}

function toSearchParams(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.toString();
}

/** Liste paginée des opportunités. */
export function useCatalogList(args: {
  tab: CatalogTab;
  page: number;
  perPage: number;
  filters: CatalogFilters;
}) {
  const query = toSearchParams({
    tab: args.tab,
    page: args.page,
    perPage: args.perPage,
    ...args.filters,
  });

  return useQuery<CatalogListResponse>({
    queryKey: ['catalogue', 'liste', query],
    queryFn: ({ signal }) => apiRequest<CatalogListResponse>(`/v1/catalog/products?${query}`, { signal }),
    // Le classement « Pour vous » dépend de la session : on garde la page précédente
    // affichée pendant le rechargement plutôt que de faire clignoter l'écran.
    placeholderData: (previous) => previous,
  });
}

/** Fiche d'un produit, par identifiant ou par libellé d'URL. */
export function useCatalogProduct(idOrSlug: string) {
  return useQuery<CatalogProductResponse>({
    queryKey: ['catalogue', 'produit', idOrSlug],
    queryFn: ({ signal }) =>
      apiRequest<CatalogProductResponse>(`/v1/catalog/products/${encodeURIComponent(idOrSlug)}`, { signal }),
  });
}

/** Simulateur d'investissement : un budget, une estimation. */
export function useInvestmentSimulation(idOrSlug: string) {
  return useMutation<InvestmentSimulationResponse, Error, number>({
    mutationFn: (budgetXaf) =>
      apiRequest<InvestmentSimulationResponse>(
        `/v1/catalog/products/${encodeURIComponent(idOrSlug)}/simulate`,
        { method: 'POST', body: JSON.stringify({ budgetXaf }) },
      ),
  });
}

/** Date courte en français : aucun chiffre daté ne s'affiche sans elle. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CM', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
