import type { TrackedOrderDetailResponse, TrackedOrderListResponse } from '@ws/contracts';
import { apiRequest } from '@/lib/api-fetcher';

/**
 * Appels du suivi client (LOG-02). Le client généré par Orval ne connaît pas encore ces routes :
 * on passe par le transport commun, avec les mêmes types que le serveur (@ws/contracts).
 */
export function fetchOrders() {
  return apiRequest<TrackedOrderListResponse>('/v1/logistics/orders');
}

export function fetchOrder(reference: string) {
  return apiRequest<TrackedOrderDetailResponse>(
    `/v1/logistics/orders/${encodeURIComponent(reference)}`,
  );
}

/** Date et heure en français, courtes. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Une preuve se présente comme une photo si son adresse le laisse penser, sinon comme un document. */
export function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i.test(url) || /\/image\/upload\//.test(url);
}
