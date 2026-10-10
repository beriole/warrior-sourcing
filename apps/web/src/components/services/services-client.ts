'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateServiceOrderRequest,
  CreateServiceOrderResponse,
  RetryServiceOrderPaymentRequest,
  ServiceCatalogResponse,
  ServiceCategory,
  ServiceDetailResponse,
  ServiceOrderListResponse,
  ServiceOrderResponse,
} from '@ws/contracts';
import { apiRequest } from '@/lib/api-fetcher';

/**
 * Accès aux routes des prestations (lot SRV).
 *
 * Même convention que l'Academy : le client généré par Orval ne couvre pas encore ces
 * routes, donc les appels passent par le transport commun (`apiRequest`) et sont typés
 * avec les schémas de `@ws/contracts`. Le contrat reste unique, la régénération ne
 * changera que la plomberie.
 */

export interface ServiceFilters {
  category?: ServiceCategory;
  search?: string;
  orderableOnly?: boolean;
}

export const EMPTY_SERVICE_FILTERS: ServiceFilters = {};

function toSearchParams(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) search.set(key, String(value));
  }
  return search.toString();
}

/** Catalogue des prestations. Public : lisible sans compte. */
export function useServiceCatalog(args: { page: number; perPage: number; filters: ServiceFilters }) {
  const query = toSearchParams({ page: args.page, perPage: args.perPage, ...args.filters });

  return useQuery<ServiceCatalogResponse>({
    queryKey: ['services', 'catalogue', query],
    queryFn: ({ signal }) => apiRequest<ServiceCatalogResponse>(`/v1/services?${query}`, { signal }),
    placeholderData: (previous) => previous,
  });
}

/** Fiche d'une prestation : livrables, conditions, prérequis, tarif et délai. */
export function useService(slug: string) {
  return useQuery<ServiceDetailResponse>({
    queryKey: ['services', 'prestation', slug],
    queryFn: ({ signal }) => apiRequest<ServiceDetailResponse>(`/v1/services/${encodeURIComponent(slug)}`, { signal }),
  });
}

/** Commandes de prestation du compte connecté. */
export function useServiceOrders() {
  return useQuery<ServiceOrderListResponse>({
    queryKey: ['services', 'demandes'],
    queryFn: ({ signal }) => apiRequest<ServiceOrderListResponse>('/v1/service-orders', { signal }),
  });
}

/** Suivi d'une commande de prestation. */
export function useServiceOrder(reference: string) {
  return useQuery<ServiceOrderResponse>({
    queryKey: ['services', 'demande', reference],
    queryFn: ({ signal }) =>
      apiRequest<ServiceOrderResponse>(`/v1/service-orders/${encodeURIComponent(reference)}`, { signal }),
    // Un paiement en cours se conclut par webhook : on relit tant qu'il n'est pas conclu.
    refetchInterval: (query) =>
      query.state.data?.order.status === 'PENDING_PAYMENT' ? 5_000 : false,
  });
}

/** Commande d'une prestation : le montant vient du catalogue, jamais d'ici. */
export function useOrderService() {
  const queryClient = useQueryClient();

  return useMutation<CreateServiceOrderResponse, Error, CreateServiceOrderRequest>({
    mutationFn: (body) =>
      apiRequest<CreateServiceOrderResponse>('/v1/service-orders', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['services', 'demandes'] });
    },
  });
}

/** Relance du paiement d'une demande restée impayée. */
export function useRetryServicePayment(reference: string) {
  const queryClient = useQueryClient();

  return useMutation<CreateServiceOrderResponse, Error, RetryServiceOrderPaymentRequest>({
    mutationFn: (body) =>
      apiRequest<CreateServiceOrderResponse>(
        `/v1/service-orders/${encodeURIComponent(reference)}/payment`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['services', 'demande', reference] });
    },
  });
}

/** Annulation d'une demande tant qu'elle n'est pas payée. */
export function useCancelServiceOrder(reference: string) {
  const queryClient = useQueryClient();

  return useMutation<ServiceOrderResponse, Error, void>({
    mutationFn: () =>
      apiRequest<ServiceOrderResponse>(`/v1/service-orders/${encodeURIComponent(reference)}/annulation`, {
        method: 'PATCH',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['services', 'demande', reference] });
      void queryClient.invalidateQueries({ queryKey: ['services', 'demandes'] });
    },
  });
}

/** Date courte, comme ailleurs dans l'application. */
export function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
