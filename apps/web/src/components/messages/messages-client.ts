'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConversationCategory,
  ConversationListResponse,
  ConversationResponse,
  CreateConversationRequest,
  PostMessageRequest,
} from '@ws/contracts';
import { apiRequest } from '@/lib/api-fetcher';

/**
 * Messagerie côté site (lot MSG).
 *
 * Toutes les écritures renvoient la conversation complète recalculée par le serveur :
 * l'écran n'a pas à deviner le nouvel état, ni à ajouter le message localement en
 * espérant qu'il est bien parti.
 */
export function useConversations(category?: ConversationCategory) {
  const query = category ? `?category=${category}` : '';

  return useQuery<ConversationListResponse>({
    queryKey: ['conversations', category ?? 'toutes'],
    queryFn: ({ signal }) => apiRequest<ConversationListResponse>(`/v1/conversations${query}`, { signal }),
    retry: false,
  });
}

export function useConversation(id: string) {
  return useQuery<ConversationResponse>({
    queryKey: ['conversation', id],
    queryFn: ({ signal }) =>
      apiRequest<ConversationResponse>(`/v1/conversations/${encodeURIComponent(id)}`, { signal }),
    // Une réponse de l'équipe peut arriver pendant qu'on lit : on relit sans brusquer le
    // serveur. Le temps réel viendra avec MSG-02.
    refetchInterval: 30_000,
  });
}

function useInvalidation(id?: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['conversation', id] });
  };
}

export function useCreateConversation() {
  const rafraichir = useInvalidation();

  return useMutation<ConversationResponse, Error, CreateConversationRequest>({
    mutationFn: (body) =>
      apiRequest<ConversationResponse>('/v1/conversations', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: rafraichir,
  });
}

export function usePostMessage(id: string) {
  const rafraichir = useInvalidation(id);

  return useMutation<ConversationResponse, Error, PostMessageRequest>({
    mutationFn: (body) =>
      apiRequest<ConversationResponse>(`/v1/conversations/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: rafraichir,
  });
}

/** Date et heure courtes : un échange se lit dans son ordre, pas à la minute près. */
export function dateMessage(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
