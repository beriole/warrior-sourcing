'use client';

import { Compteur } from '@ws/ui';
import { useEffect, useRef, useState } from 'react';

/**
 * Chiffre qui monte depuis zéro **quand on arrive devant lui**, et seulement alors.
 *
 * Deux refus, tous deux vérifiés à l'écran :
 *
 * - On ne compte pas un chiffre **déjà visible au chargement**. Le décompte afficherait
 *   « 0 formation au catalogue » pendant une seconde, en gros caractères, à l'instant
 *   précis où quelqu'un découvre la page. Un chiffre faux affiché n'est pas une
 *   animation, c'est une erreur qui dure moins longtemps que les autres.
 * - On ne compte pas deux fois. L'observateur se détache au premier passage : rien ne
 *   repart à l'envers quand on remonte.
 *
 * Le rendu de départ est la **valeur réelle**, pas zéro : si le script n'arrive jamais,
 * c'est le bon chiffre qui reste affiché.
 */
export function CompteurAuScroll({ valeur, className }: { valeur: number; className?: string }) {
  const ancre = useRef<HTMLSpanElement>(null);
  const [anime, setAnime] = useState(false);

  useEffect(() => {
    const cible = ancre.current;
    if (!cible || !('IntersectionObserver' in window)) return;

    // Déjà sous les yeux à l'ouverture : on laisse le chiffre tel quel.
    const cadre = cible.getBoundingClientRect();
    if (cadre.top < window.innerHeight && cadre.bottom > 0) return;

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue;
          setAnime(true);
          observateur.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, []);

  return (
    <span ref={ancre} className={className}>
      {anime ? (
        <Compteur valeur={valeur} depuis={0} />
      ) : (
        <span className="figures tabular-nums">{valeur.toLocaleString('fr-FR')}</span>
      )}
    </span>
  );
}
