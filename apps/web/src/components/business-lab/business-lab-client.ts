'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BusinessProjectInput,
  BusinessProjectListResponse,
  BusinessProjectResponse,
  BusinessSaleInput,
} from '@ws/contracts';
import { apiRequest } from '@/lib/api-fetcher';

/**
 * Business Lab côté site (lot LAB).
 *
 * Toutes les écritures renvoient le projet recalculé par le serveur : l'écran ne refait
 * jamais le calcul de son côté, donc un chiffre affiché ne peut pas diverger d'un chiffre
 * enregistré.
 */
export function useBusinessProjects() {
  return useQuery<BusinessProjectListResponse>({
    queryKey: ['business-lab', 'projets'],
    queryFn: ({ signal }) => apiRequest<BusinessProjectListResponse>('/v1/business-lab/projets', { signal }),
    retry: false,
  });
}

export function useBusinessProject(id: string) {
  return useQuery<BusinessProjectResponse>({
    queryKey: ['business-lab', 'projet', id],
    queryFn: ({ signal }) =>
      apiRequest<BusinessProjectResponse>(`/v1/business-lab/projets/${encodeURIComponent(id)}`, { signal }),
  });
}

function useInvalidation(id?: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['business-lab', 'projets'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['business-lab', 'projet', id] });
  };
}

export function useCreateProject() {
  const rafraichir = useInvalidation();

  return useMutation<BusinessProjectResponse, Error, BusinessProjectInput>({
    mutationFn: (body) =>
      apiRequest<BusinessProjectResponse>('/v1/business-lab/projets', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: rafraichir,
  });
}

export function useAddSale(projectId: string) {
  const rafraichir = useInvalidation(projectId);

  return useMutation<BusinessProjectResponse, Error, BusinessSaleInput>({
    mutationFn: (body) =>
      apiRequest<BusinessProjectResponse>(
        `/v1/business-lab/projets/${encodeURIComponent(projectId)}/ventes`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: rafraichir,
  });
}

export function useRemoveSale(projectId: string) {
  const rafraichir = useInvalidation(projectId);

  return useMutation<BusinessProjectResponse, Error, string>({
    mutationFn: (saleId) =>
      apiRequest<BusinessProjectResponse>(
        `/v1/business-lab/projets/${encodeURIComponent(projectId)}/ventes/${encodeURIComponent(saleId)}`,
        { method: 'DELETE' },
      ),
    onSuccess: rafraichir,
  });
}

export function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Date du jour au format d'un champ `date`. */
export function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Un champ `date` ne transporte pas d'heure : on complète pour obtenir un instant ISO. */
export function enInstant(jour: string): string {
  return new Date(`${jour}T12:00:00.000Z`).toISOString();
}
