/**
 * Visuels de la page d'accueil.
 *
 * Déclarés ici, et nulle part ailleurs : remplacer une photo revient à déposer un fichier
 * du même nom dans `public/images/`, sans toucher au code. Les crédits et les contraintes
 * de format sont dans `public/images/CREDITS.md`.
 *
 * `alt` décrit **ce que la photo montre réellement**, pas ce qu'on aimerait qu'elle
 * illustre. Aucune n'affirme un lieu qui n'a pas été vérifié : écrire « usine à
 * Guangzhou » sous une photo prise ailleurs est un mensonge, même petit, et c'est le
 * genre de petit mensonge qui finit par décrédibiliser le reste de la page (§54).
 */
export type Visuel = {
  src: string;
  alt: string;
  /** Rapport largeur/hauteur du fichier, pour réserver la place et éviter les sauts. */
  width: number;
  height: number;
};

export const VISUELS = {
  /** Terminal à conteneurs vu du ciel. Le plus large et le plus lisible en petit. */
  terminal: {
    src: '/images/conteneurs-empiles.jpg',
    alt: 'Terminal à conteneurs vu du ciel : portiques, piles de conteneurs et navires à quai.',
    width: 1600,
    height: 1067,
  },
  /** Porte-conteneurs à quai, cadrage vertical. */
  navire: {
    src: '/images/port-conteneurs.jpg',
    alt: 'Porte-conteneurs à quai, chargé de conteneurs, sous des portiques de déchargement.',
    width: 1600,
    height: 2400,
  },
  /** Entrepôt : marchandises palettisées en rayonnage. */
  entrepot: {
    src: '/images/entrepot-cartons.jpg',
    alt: 'Entrepôt de stockage : palettes filmées et cartons rangés en hauteur sur des rayonnages.',
    width: 1600,
    height: 1067,
  },
} as const satisfies Record<string, Visuel>;
