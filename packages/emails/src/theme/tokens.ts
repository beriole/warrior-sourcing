/**
 * Tokens du design system email.
 * Mêmes couleurs que l'application (packages/ui/src/styles/tokens.css), exprimées en valeurs
 * littérales : un client mail ne comprend ni les variables CSS ni les classes utilitaires.
 * Aucun composant ne doit écrire une couleur ou une taille en dur.
 */

export const color = {
  /** Identité et CTA principaux. */
  imperial: '#C8102E',
  imperialDeep: '#9E0C24',
  /** Zones fortes, profondeur. */
  crimson: '#6B0F1A',
  crimsonDeep: '#4A0A12',
  /** Premium, confirmation, accent. */
  gold: '#D4A537',
  goldBright: '#EFC75E',
  goldSoft: '#F5E7C4',
  goldInk: '#7D5A12',
  /** Fonds contrastés. */
  charcoal: '#0C0C10',
  charcoalRaised: '#17171E',
  night: '#0E1A33',
  nightRaised: '#17274A',
  /** Surfaces claires. */
  cream: '#FAF5EC',
  creamDeep: '#F1E9DA',
  white: '#FFFFFF',
  /** Texte. */
  ink: '#16161A',
  inkMuted: '#5E5A55',
  onDark: '#F3EFE8',
  onDarkMuted: '#A9A29A',
  /** États : toujours accompagnés d'un mot, jamais de la couleur seule. */
  success: '#1E7A4C',
  successSoft: '#E3F3EA',
  warning: '#9A5B0B',
  danger: '#B42318',
  /** Filets et séparateurs. */
  line: '#E6DED0',
  lineDark: '#2A2A33',
} as const;

export const font = {
  display: "'Sora', 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif",
  body: "'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif",
  /** Chiffres financiers : chasse fixe pour l'alignement, graisse forte pour la présence. */
  figures: "'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif",
} as const;

/** Échelle typographique : label, titre, sous-titre, corps, chiffre, secondaire. */
export const type = {
  label: { fontSize: '11px', lineHeight: '16px', fontWeight: 700, letterSpacing: '1.4px' },
  title: { fontSize: '28px', lineHeight: '34px', fontWeight: 800, letterSpacing: '-0.5px' },
  titleSmall: { fontSize: '20px', lineHeight: '27px', fontWeight: 700, letterSpacing: '-0.2px' },
  subtitle: { fontSize: '16px', lineHeight: '25px', fontWeight: 400 },
  body: { fontSize: '15px', lineHeight: '24px', fontWeight: 400 },
  amount: { fontSize: '34px', lineHeight: '40px', fontWeight: 800, letterSpacing: '-0.8px' },
  amountSmall: { fontSize: '20px', lineHeight: '26px', fontWeight: 700 },
  small: { fontSize: '13px', lineHeight: '20px', fontWeight: 400 },
  micro: { fontSize: '11px', lineHeight: '17px', fontWeight: 400 },
} as const;

export const space = {
  xs: '6px',
  sm: '10px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '44px',
} as const;

export const radius = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  pill: '999px',
} as const;

/** Largeur du contenu principal : 640 px, dans la fourchette recommandée 600–680. */
export const layout = {
  width: 640,
  gutter: '28px',
  gutterMobile: '18px',
} as const;

/** Dégradés maîtrisés. Les clients qui ne les gèrent pas retombent sur `fallback`. */
export const gradient = {
  header: {
    css: `linear-gradient(135deg, ${color.crimsonDeep} 0%, ${color.imperialDeep} 45%, ${color.imperial} 100%)`,
    fallback: color.crimsonDeep,
  },
  gold: {
    css: `linear-gradient(90deg, ${color.gold} 0%, ${color.goldBright} 50%, ${color.gold} 100%)`,
    fallback: color.gold,
  },
  night: {
    css: `linear-gradient(160deg, ${color.night} 0%, ${color.charcoal} 100%)`,
    fallback: color.night,
  },
  route: {
    css: `linear-gradient(90deg, ${color.imperial} 0%, ${color.gold} 100%)`,
    fallback: color.gold,
  },
} as const;

export type Gradient = keyof typeof gradient;

/** Style d'un fond dégradé avec sa couleur de repli, à étaler dans un style inline. */
export function gradientStyle(name: Gradient) {
  return {
    backgroundColor: gradient[name].fallback,
    backgroundImage: gradient[name].css,
  };
}
