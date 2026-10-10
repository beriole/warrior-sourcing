import type { Transition, Variants } from 'motion/react';

/**
 * Jetons de mouvement du produit.
 *
 * Deux registres, jamais mélangés :
 * — « interface » : court, net, sans rebond. Il confirme une action dans un outil
 *   qu'on utilise dix fois par jour. Sur-animer une interface la rend fatigante.
 * — « récit » : plus ample, utilisé sur les pages publiques, où le mouvement
 *   installe la marque et conduit la lecture.
 *
 * Règle tenue partout : aucune opacité animée seule. Un geste combine toujours
 * au moins deux propriétés (position, échelle, flou, masque, tracé).
 */

/** Durées en secondes. Le nom dit l'intention, pas la valeur. */
export const duration = {
  /** Survol, appui, bascule d'état : doit paraître instantané. */
  micro: 0.14,
  /** Entrée d'un élément d'interface. */
  enter: 0.26,
  /** Valeur par défaut d'un déplacement. */
  base: 0.42,
  /** Révélation d'un titre, mouvement de caméra. */
  reveal: 0.75,
  /** Respiration longue : trajet, halo, boucle. */
  breath: 1.2,
} as const;

/**
 * Courbes.
 * Une entrée décélère : l'œil suit un objet qui se pose.
 * Une sortie accélère : ce qui part doit dégager sans voler l'attention.
 */
export const ease = {
  out: [0.16, 1, 0.3, 1],
  in: [0.7, 0, 0.84, 0],
  inOut: [0.65, 0, 0.35, 1],
} as const satisfies Record<string, [number, number, number, number]>;

/** Ressorts. `damping` élevé = aucun rebond : c'est le bon défaut sur du texte. */
export const spring = {
  /** Interface : arrive vite, se pose net. */
  ui: { type: 'spring', stiffness: 420, damping: 38, mass: 0.6 },
  /** Défaut : un soupçon de dépassement. */
  base: { type: 'spring', stiffness: 220, damping: 26, mass: 0.8 },
  /** Accent joueur, réservé aux petits éléments (pastilles, coches, badges). */
  playful: { type: 'spring', stiffness: 320, damping: 15, mass: 0.7 },
  /** Grands mouvements lents, qualité cinéma. */
  cinematic: { type: 'spring', stiffness: 90, damping: 20, mass: 1.4 },
} as const satisfies Record<string, Transition>;

/**
 * Décalages d'une série. Une série n'entre jamais d'un bloc.
 * Au-delà de sept éléments, le pas linéaire traîne : on le réduit.
 */
export const stagger = {
  letters: 0.03,
  items: 0.06,
  blocks: 0.1,
} as const;

/** Pas adapté à la longueur de la série, pour éviter les entrées interminables. */
export function staggerFor(count: number, base: number = stagger.items): number {
  if (count <= 4) return base;
  if (count <= 7) return base * 0.8;
  return Math.max(base * 0.45, 0.02);
}

/* ─────────────────────────── Gestes réutilisables ─────────────────────────── */

/**
 * Le mot monte depuis une ligne de coupe. Le parent porte `overflow: hidden`.
 * C'est le geste des titres : il donne une matière que le fondu n'a pas.
 */
export const maskedRise: Variants = {
  hidden: { y: '115%' },
  shown: { y: '0%', transition: { duration: duration.reveal, ease: ease.out } },
};

/**
 * Flou qui se résorbe plus vite que la translation : le texte devient lisible
 * avant d'être posé. Utilisé pour les paragraphes et les sous-titres.
 */
export const blurRise: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
  shown: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: duration.base,
      ease: ease.out,
      filter: { duration: duration.enter, ease: ease.out },
    },
  },
};

/** Les cartes partent de 0,96 : partir de zéro produit un « pop » de dessin animé. */
export const cardRise: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { ...spring.base } },
};

/** Surtitre en capitales : l'interlettrage s'ouvre pendant l'arrivée. */
export const letterOpen: Variants = {
  hidden: { opacity: 0, letterSpacing: '0.02em' },
  shown: {
    opacity: 1,
    letterSpacing: '0.18em',
    transition: { duration: duration.reveal, ease: ease.out },
  },
};

/** Balayage : la bande se révèle de la gauche vers la droite. */
export const wipeIn: Variants = {
  hidden: { clipPath: 'inset(0 100% 0 0)' },
  shown: { clipPath: 'inset(0 0% 0 0)', transition: { duration: duration.reveal, ease: ease.out } },
};

/** Conteneur d'une série : il orchestre, il ne bouge pas lui-même. */
export function staggerParent(count: number, delayChildren = 0): Variants {
  return {
    hidden: {},
    shown: { transition: { staggerChildren: staggerFor(count), delayChildren } },
  };
}

/** Entrée d'interface : courte, sans rebond, pour les écrans connectés. */
export const uiEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: { duration: duration.enter, ease: ease.out } },
};

/** Sortie d'interface : plus rapide que l'entrée, elle dégage le passage. */
export const uiExit = { opacity: 0, y: -8, transition: { duration: duration.micro, ease: ease.in } };
