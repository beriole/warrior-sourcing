'use client';

import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { Bookmark } from 'lucide-react';
import { cn } from '../lib/utils';
import { spring } from '../motion/tokens';

/**
 * Bouton « mettre de côté » (PLAT-09, §36).
 *
 * Volontairement sans connaissance de l'API : il reçoit un état et une fonction. Le même
 * bouton sert donc pour un produit, un fournisseur, une formation ou une prestation, et
 * la logique d'appel reste dans l'application.
 *
 * Deux précautions d'usage réel :
 * - le libellé accessible dit l'action à venir (« Mettre de côté » / « Retirer »), pas
 *   l'état courant, parce que c'est ce qu'on annonce d'un bouton ;
 * - la cible fait 44 px, même quand l'icône est petite : on tapote au pouce, souvent en
 *   marchant.
 */
export function BoutonFavori({
  actif,
  onBasculer,
  enCours = false,
  className,
  libelle = 'cette fiche',
}: {
  actif: boolean;
  onBasculer: () => void;
  enCours?: boolean;
  className?: string;
  /** Ce dont on parle, pour le lecteur d'écran : « ce produit », « cette formation »… */
  libelle?: string;
}) {
  const reduit = useReducedMotion();

  return (
    <m.button
      type="button"
      onClick={(event) => {
        // Le bouton vit souvent dans une carte cliquable : on ne veut pas ouvrir la fiche.
        event.preventDefault();
        event.stopPropagation();
        onBasculer();
      }}
      disabled={enCours}
      aria-pressed={actif}
      aria-label={actif ? `Retirer ${libelle} de mes favoris` : `Mettre ${libelle} de côté`}
      title={actif ? 'Retirer de mes favoris' : 'Mettre de côté'}
      whileTap={reduit ? undefined : { scale: 0.88 }}
      transition={spring.ui}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors',
        'focus-visible:ring-2 focus-visible:ring-imperial focus-visible:outline-none',
        actif ? 'text-gold hover:bg-surface-muted' : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
        enCours && 'opacity-60',
        className,
      )}
    >
      <m.span
        // Le marque-page se remplit d'un coup quand on le pose : la confirmation est le
        // geste lui-même, pas un message qui s'affiche ailleurs sur l'écran.
        key={actif ? 'pose' : 'retire'}
        initial={reduit ? false : { scale: actif ? 0.6 : 1 }}
        animate={{ scale: 1 }}
        transition={spring.playful}
        className="flex"
      >
        <Bookmark className="size-5" fill={actif ? 'currentColor' : 'none'} aria-hidden />
      </m.span>
    </m.button>
  );
}
