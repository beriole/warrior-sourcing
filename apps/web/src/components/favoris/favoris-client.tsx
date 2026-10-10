'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  FavoriteListResponse,
  FavoriteMutationResponse,
  FavoriteTargetType,
} from '@ws/contracts';
import { BoutonFavori } from '@ws/ui';
import { apiRequest } from '@/lib/api-fetcher';

/**
 * Favoris côté site (PLAT-09, §36).
 *
 * La liste complète des favoris du compte sert d'état partagé : un même produit affiché
 * dans une grille et sur sa fiche montre le même bouton, sans que chaque bouton
 * interroge le serveur de son côté.
 */
export function useFavorites() {
  return useQuery<FavoriteListResponse>({
    queryKey: ['favoris'],
    queryFn: ({ signal }) => apiRequest<FavoriteListResponse>('/v1/favoris?perPage=100', { signal }),
    // Sans session, la route répond 401 : on n'insiste pas, le bouton reste inactif.
    retry: false,
    staleTime: 30_000,
  });
}

function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation<FavoriteMutationResponse, Error, { targetType: FavoriteTargetType; targetId: string; actif: boolean }>(
    {
      mutationFn: ({ targetType, targetId, actif }) =>
        actif
          ? apiRequest<FavoriteMutationResponse>(`/v1/favoris/${targetType}/${encodeURIComponent(targetId)}`, {
              method: 'DELETE',
            })
          : apiRequest<FavoriteMutationResponse>('/v1/favoris', {
              method: 'POST',
              body: JSON.stringify({ targetType, targetId }),
            }),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['favoris'] });
      },
    },
  );
}

/**
 * Bouton « mettre de côté » branché sur l'API.
 *
 * Le bouton n'est pas affiché tant qu'on ne sait pas si le compte est connecté : proposer
 * de mettre de côté puis renvoyer une erreur d'authentification serait une fausse promesse.
 */
export function FavoriToggle({
  targetType,
  targetId,
  libelle,
  className,
}: {
  targetType: FavoriteTargetType;
  targetId: string;
  libelle?: string;
  className?: string;
}) {
  const { data, isError } = useFavorites();
  const basculer = useToggleFavorite();

  if (isError || !data) return null;

  const actif = data.items.some((item) => item.targetType === targetType && item.targetId === targetId);

  return (
    <BoutonFavori
      actif={actif}
      enCours={basculer.isPending}
      libelle={libelle}
      className={className}
      onBasculer={() => basculer.mutate({ targetType, targetId, actif })}
    />
  );
}
