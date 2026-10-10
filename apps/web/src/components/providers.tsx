'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { domMax, LazyMotion, MotionConfig } from 'motion/react';
import { useState, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Réseau mobile modeste : on évite les rechargements inutiles.
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/*
        `domMax` et non `domAnimation` : l'indicateur d'onglet glisse d'un onglet à
        l'autre par `layoutId`, et la projection de disposition n'est fournie que
        par `domMax`. Avec `domAnimation`, la propriété est acceptée sans effet —
        l'indicateur saute, sans erreur pour le signaler. Le surcoût est chargé à
        la demande par LazyMotion, pas dans le premier rendu.
      */}
      <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </LazyMotion>
    </QueryClientProvider>
  );
}
