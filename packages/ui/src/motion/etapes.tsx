'use client';

import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import type { ReactNode } from 'react';
import { duration, ease, spring } from './tokens';

/**
 * Passage d'une étape à l'autre dans un formulaire en plusieurs temps.
 *
 * Le sens porte le sens : en avant, l'étape arrive par la droite ; en arrière,
 * elle revient par la gauche. L'utilisateur sait ainsi s'il a avancé ou reculé
 * sans relire le titre — ce qui compte quand on remplit un formulaire au doigt,
 * debout, sur un petit écran.
 *
 * La hauteur du cadre est animée séparément : deux étapes n'ont pas la même
 * longueur, et un cadre qui saute d'une hauteur à l'autre déplace le bouton
 * juste avant qu'on appuie dessus.
 */
export function TransitionEtape({
  etape,
  sens = 'avant',
  children,
  className,
}: {
  /** Identifiant de l'étape affichée : c'est son changement qui déclenche le passage. */
  etape: string | number;
  sens?: 'avant' | 'arriere';
  children: ReactNode;
  className?: string;
}) {
  const reduit = useReducedMotion();

  if (reduit) return <div className={className}>{children}</div>;

  const depart = sens === 'avant' ? 28 : -28;

  return (
    <m.div layout className={className} transition={spring.ui}>
      {/*
        `wait` : l'étape sortante disparaît avant que la suivante n'arrive. Deux
        étapes superposées sur un formulaire donneraient deux énoncés lisibles en
        même temps, ce qui est pire qu'un court vide. C'est aussi le mode déjà
        employé pour les changements de page : une seule grammaire dans l'app.
      */}
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={etape}
          initial={{ opacity: 0, x: depart }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -depart / 2, transition: { duration: duration.micro, ease: ease.in } }}
          transition={{ duration: duration.enter, ease: ease.out }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </m.div>
  );
}
