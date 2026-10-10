import type { CSSProperties, ReactNode } from 'react';
import { Children } from 'react';
import { stagger, staggerFor } from './tokens';

/**
 * Grille de résultats qui se renouvellent.
 *
 * Les révélations au défilement (`ws-onview`) conviennent à une page qui ne
 * bouge plus : elles se jouent une fois et restent. Une liste filtrée, elle,
 * change sur place — et comme React réutilise les mêmes nœuds, rien ne se
 * rejouerait. D'où `signature` : elle identifie la requête (onglet, filtres,
 * page) et sert de clé. Quand elle change, la liste est reconstruite, donc
 * l'animation d'entrée repart. C'est ce mouvement qui dit « votre filtre a été
 * pris en compte », là où un remplacement instantané laisse douter.
 *
 * L'entrée est en CSS et non en JavaScript. Une première version orchestrée par
 * Motion laissait la grille entièrement vide après un changement d'onglet :
 * les éléments étaient montés à leur état de départ et l'animation ne démarrait
 * jamais. Une classe CSS n'a pas cet état intermédiaire — elle se joue ou elle
 * ne se joue pas, et `both` garantit l'état final dans les deux cas.
 */
export function GrilleAnimee({
  children,
  signature,
  className,
  itemClassName,
}: {
  children: ReactNode;
  /** Change quand la requête change : onglet, filtres, page. */
  signature: string;
  className?: string;
  itemClassName?: string;
}) {
  const elements = Children.toArray(children);
  const pas = staggerFor(elements.length, stagger.items);

  return (
    <ul key={signature} className={className}>
      {elements.map((enfant, index) => (
        <li
          key={index}
          className={itemClassName ? `ws-card ${itemClassName}` : 'ws-card'}
          style={{ '--ws-delay': `${index * pas}s` } as CSSProperties}
        >
          {enfant}
        </li>
      ))}
    </ul>
  );
}
