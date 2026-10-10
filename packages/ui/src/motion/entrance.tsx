import type { CSSProperties, ElementType, ReactNode } from 'react';
import { cn } from '../lib/utils';
import { stagger, staggerFor } from './tokens';

/**
 * Entrées animées, rendues par le serveur.
 *
 * Ces composants n'émettent qu'une classe et un délai : l'animation vit dans
 * packages/ui/src/styles/motion.css et démarre à la première image, sans attendre
 * le JavaScript. Conséquence directe : le texte est là même si le script tarde,
 * échoue, ou si l'appareil est lent — ce qui est la situation normale de nos
 * utilisateurs, pas l'exception.
 *
 * Le mouvement disparaît de lui-même quand le système demande moins d'animations :
 * toute la feuille est sous `prefers-reduced-motion: no-preference`.
 */

type Geste = 'texte' | 'paragraphe' | 'carte' | 'label' | 'interface';

const CLASSES: Record<Geste, string> = {
  texte: 'ws-mask',
  paragraphe: 'ws-blur',
  carte: 'ws-card',
  label: 'ws-label',
  interface: 'ws-ui',
};

/**
 * SUPPRESSION_HYDRATATION — pourquoi `suppressHydrationWarning` accompagne `ws-onview`.
 *
 * Le script de révélation s'exécute avant la première image, donc avant l'hydratation.
 * Il pose `data-ws-vu` sur les blocs déjà présents à l'écran, pour qu'ils ne soient
 * jamais cachés. React compare ensuite tous les attributs des éléments qu'il a rendus,
 * trouve un attribut qu'il n'a pas écrit, et signale une divergence sur chaque page
 * ayant un bloc révélable au-dessus de la ligne de flottaison.
 *
 * L'exception est **ciblée** : elle ne porte que sur l'élément que ce script touche,
 * et uniquement quand il est effectivement révélable. Elle ne masque aucune divergence
 * dans le contenu, qui reste comparé normalement. C'est le cas que React prévoit
 * explicitement — du code extérieur à React qui modifie le DOM avant l'hydratation.
 *
 * Tout élément portant `ws-onview` à la main doit porter `suppressHydrationWarning`
 * avec lui. C'est précisément pour ne pas avoir à y penser que ces composants existent.
 */

/**
 * Gestes de révélation au défilement. Vocabulaire fermé, et volontairement minuscule :
 * une page qui mélange balayage, volet, glissement et montée se lit comme un diaporama.
 * Un projet choisit une grammaire et s'y tient.
 */
export type GesteAuScroll = 'montee' | 'cote' | 'volet';

const SCROLL: Record<GesteAuScroll, string> = {
  /** Montée depuis le bas : tout ce qui se lit de haut en bas. */
  montee: '',
  /** Glissement depuis la droite : une suite d'étapes qui se lit de gauche à droite. */
  cote: 'ws-geste-cote',
  /** Volet qui se lève : réservé aux images, où un fondu ressemble à un chargement raté. */
  volet: 'ws-geste-volet',
};

function delai(secondes: number): CSSProperties {
  return secondes ? ({ '--ws-delay': `${secondes}s` } as CSSProperties) : {};
}

/** Un élément qui entre au chargement. `geste` choisit le vocabulaire, pas des valeurs. */
export function Entree({
  children,
  geste = 'paragraphe',
  delai: retard = 0,
  className,
  as: Composant = 'div',
}: {
  children: ReactNode;
  geste?: Geste;
  delai?: number;
  className?: string;
  as?: ElementType;
}) {
  // Le masque appartient au parent : c'est lui qui coupe la ligne dont le mot monte.
  if (geste === 'texte') {
    return (
      <span className="ws-mask" style={delai(retard)}>
        <Composant className={className}>{children}</Composant>
      </span>
    );
  }

  return (
    <Composant className={cn(CLASSES[geste], className)} style={delai(retard)}>
      {children}
    </Composant>
  );
}

/**
 * Série révélée au défilement : chaque élément entre à son tour, dans le sens
 * de lecture. Le pas se resserre quand la liste s'allonge, sinon la fin traîne.
 */
export function Serie({
  children,
  className,
  as: Composant = 'div',
}: {
  children: ReactNode;
  /** Conservé pour la symétrie d'appel ; le pas est porté par chaque élément. */
  nombre?: number;
  delai?: number;
  className?: string;
  as?: ElementType;
}) {
  return <Composant className={className}>{children}</Composant>;
}

/**
 * Élément d'une série. `index` et `total` donnent son rang : c'est lui qui porte
 * le décalage, ce qui permet au parent de rester un simple conteneur de grille.
 */
export function ElementDeSerie({
  children,
  index = 0,
  total = 4,
  geste = 'carte',
  auScroll = true,
  className,
  as: Composant = 'div',
  pas,
  delaiBase = 0,
  gesteAuScroll = 'montee',
}: {
  children: ReactNode;
  index?: number;
  total?: number;
  geste?: Geste;
  /** Faux pour une série visible dès le chargement (le hero, par exemple). */
  auScroll?: boolean;
  className?: string;
  as?: ElementType;
  pas?: number;
  /** Attente avant le premier élément, quand la série suit une autre entrée. */
  delaiBase?: number;
  /** Geste de la révélation au défilement. Sans effet quand `auScroll` est faux. */
  gesteAuScroll?: GesteAuScroll;
}) {
  const decalage = delaiBase + (pas ?? staggerFor(total, stagger.items)) * index;

  return (
    <Composant
      className={cn(
        auScroll ? cn('ws-onview', SCROLL[gesteAuScroll]) : CLASSES[geste],
        className,
      )}
      style={delai(decalage)}
      // Voir SUPPRESSION_HYDRATATION, plus bas.
      suppressHydrationWarning={auScroll}
    >
      {children}
    </Composant>
  );
}

/**
 * Élément isolé révélé à son premier passage devant l'écran.
 *
 * `ElementDeSerie` fait la même chose mais demande un rang dans une série ; ici il
 * n'y a qu'un bloc, et le rang n'aurait aucun sens.
 */
export function AuScroll({
  children,
  geste = 'montee',
  delai: retard = 0,
  className,
  as: Composant = 'div',
}: {
  children: ReactNode;
  geste?: GesteAuScroll;
  delai?: number;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Composant className={cn('ws-onview', SCROLL[geste], className)} style={delai(retard)} suppressHydrationWarning>
      {children}
    </Composant>
  );
}

/**
 * Titre de section, avec son filet qui se trace.
 *
 * Le filet n'est pas un ornement : il marque la frontière entre deux sections d'une
 * page longue, et son tracé de gauche à droite donne le sens de lecture. Il est en
 * SVG parce qu'un trait qui se dessine demande un tracé ; une bordière qui grandit
 * en largeur produit un étirement, pas un tracé.
 */
export function TitreSection({
  children,
  surtitre,
  className,
  id,
}: {
  children: ReactNode;
  /** Surtitre court, en capitales. Omis quand le titre se suffit. */
  surtitre?: string;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn('ws-onview', className)} suppressHydrationWarning>
      {surtitre ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">{surtitre}</p>
      ) : null}
      <h2 id={id} className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
        {children}
      </h2>
      <svg
        aria-hidden
        viewBox="0 0 120 2"
        preserveAspectRatio="none"
        className="mt-3 h-[2px] w-20 overflow-visible"
      >
        <path
          d="M0 1H120"
          pathLength={1}
          className="ws-trace stroke-gold"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

/**
 * Titre révélé ligne par ligne, chaque ligne montant depuis sa coupe.
 * Le décalage entre lignes reste court : on lit une phrase, pas une énumération.
 */
export function TitreRevele({
  lignes,
  className,
  ligneClassName,
  delai: retard = 0,
}: {
  lignes: ReactNode[];
  className?: string;
  ligneClassName?: string;
  delai?: number;
}) {
  return (
    <span className={className}>
      {lignes.map((ligne, index) => (
        <span key={index} className="ws-mask" style={delai(retard + index * 0.09)}>
          <span className={cn('block', ligneClassName)}>{ligne}</span>
        </span>
      ))}
    </span>
  );
}
