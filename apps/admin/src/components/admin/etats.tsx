'use client';

import { Button, Card, Skeleton } from '@ws/ui';
import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import type { EtatAcces } from './api';

/**
 * États communs aux écrans d'administration (§45) : accès refusé, chargement, liste vide.
 * Aucun code technique n'est montré à l'utilisateur, et un état vide explique pourquoi.
 */

export function EcranAcces({ etat, sujet, onReessayer }: { etat: Exclude<EtatAcces, 'ok'>; sujet: string; onReessayer: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg text-center">
      <h1 className="text-lg font-bold">
        {etat === 'non-connecte' ? 'Connexion requise' : 'Accès réservé à l’administration'}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {etat === 'non-connecte'
          ? 'Connectez-vous sur le site avec un compte administrateur, puis revenez sur cette page.'
          : `Votre compte n’a pas les droits pour ${sujet}. Demandez à un administrateur.`}
      </p>
      <Button className="mt-4" variant="outline" onClick={onReessayer}>
        <RefreshCw aria-hidden />
        Réessayer
      </Button>
    </Card>
  );
}

export function SqueletteListe({ lignes = 5 }: { lignes?: number }) {
  return (
    <div className="mt-4 flex flex-col gap-2" aria-busy>
      {Array.from({ length: lignes }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function EtatVide({ titre, explication }: { titre: string; explication: string }) {
  return (
    <Card className="mt-4 text-center">
      <p className="text-sm font-semibold">{titre}</p>
      <p className="mt-1 text-sm text-muted-foreground">{explication}</p>
    </Card>
  );
}

export function MessageErreur({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function MessageInfo({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="mt-3 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
      {children}
    </p>
  );
}

/** En-tête d'écran : titre, sous-titre, et actions éventuelles à droite. */
export function EnTete({ titre, sousTitre, actions }: { titre: string; sousTitre: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titre}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sousTitre}</p>
      </div>
      {actions}
    </header>
  );
}
