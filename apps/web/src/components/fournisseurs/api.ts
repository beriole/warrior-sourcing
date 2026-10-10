import type {
  CreateSupplierRequestBody,
  SupplierContactResponse,
  SupplierDetailResponse,
  SupplierListQuery,
  SupplierListResponse,
  SupplierRequestResponse,
} from '@ws/contracts';
import { apiRequest } from '@/lib/api-fetcher';

/**
 * Appels de l'API fournisseurs (lot SUP).
 *
 * Les types viennent de @ws/contracts : ce sont exactement ceux que le serveur publie.
 * Le client généré par Orval n'est pas utilisé ici pour ne pas dépendre d'une régénération
 * pendant que les autres lots sont en cours.
 */

/** Filtres de l'écran, tels qu'ils sont manipulés par l'interface. */
export type SupplierFilters = {
  q: string;
  category: SupplierListQuery['category'] | '';
  city: string;
  type: SupplierListQuery['type'] | '';
  moqMax: string;
  customization: boolean;
  sample: boolean;
  minLevel: SupplierListQuery['minLevel'] | '';
};

export const EMPTY_FILTERS: SupplierFilters = {
  q: '',
  category: '',
  city: '',
  type: '',
  moqMax: '',
  customization: false,
  sample: false,
  minLevel: '',
};

/** Nombre de filtres réellement actifs : sert à l'indiquer sur mobile. */
export function countActiveFilters(filters: SupplierFilters): number {
  return [
    filters.category,
    filters.city,
    filters.type,
    filters.moqMax,
    filters.customization ? 'oui' : '',
    filters.sample ? 'oui' : '',
    filters.minLevel,
  ].filter(Boolean).length;
}

function toQueryString(filters: SupplierFilters, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.category) params.set('category', filters.category);
  if (filters.city) params.set('city', filters.city);
  if (filters.type) params.set('type', filters.type);
  if (filters.moqMax.trim()) params.set('moqMax', filters.moqMax.trim());
  if (filters.customization) params.set('customization', 'true');
  if (filters.sample) params.set('sample', 'true');
  if (filters.minLevel) params.set('minLevel', filters.minLevel);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return params.toString();
}

export function fetchSuppliers(filters: SupplierFilters, page: number, pageSize: number): Promise<SupplierListResponse> {
  return apiRequest<SupplierListResponse>(`/v1/suppliers?${toQueryString(filters, page, pageSize)}`);
}

export function fetchSupplier(id: string): Promise<SupplierDetailResponse> {
  return apiRequest<SupplierDetailResponse>(`/v1/suppliers/${id}`);
}

/** Coordonnées : le serveur refuse si le compte n'y a pas droit (§17). */
export function fetchSupplierContact(id: string): Promise<SupplierContactResponse> {
  return apiRequest<SupplierContactResponse>(`/v1/suppliers/${id}/contact`);
}

export function createSupplierRequest(
  id: string,
  body: CreateSupplierRequestBody,
): Promise<SupplierRequestResponse> {
  return apiRequest<SupplierRequestResponse>(`/v1/suppliers/${id}/requests`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Date lisible, en français. Une date absente n'est jamais remplacée par une valeur inventée. */
export function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString('fr-CM', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Prix fournisseur en yuans, à partir des fen stockés côté serveur. */
export function formatCny(amountMinor: number): string {
  return `${(amountMinor / 100).toLocaleString('fr-CM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CNY`;
}
