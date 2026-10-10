'use client';

import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { ease } from '@ws/ui';

/**
 * Trajet Chine → Cameroun (§6, §9, §25).
 *
 * Ce n'est pas une carte : c'est le schéma d'un voyage. Le mouvement raconte
 * l'ordre réel des opérations — le départ s'allume, la route se trace, le colis
 * parcourt cette route, les escales s'allument à son passage, l'arrivée pulse.
 * Chaque geste porte une information ; rien n'est décoratif.
 *
 * Aucune bibliothèque de cartographie : du SVG, donc rien à charger et rien à
 * bloquer sur une connexion mobile modeste.
 */
const ROUTE = 'M300 62 C 270 150, 190 178, 130 160 S 70 120, 58 132';

/** Escales, en fraction du trajet : elles s'allument quand le colis les dépasse. */
const ESCALES = [
  { cx: 252, cy: 128, avancement: 0.3, nom: 'Entrepôt Chine' },
  { cx: 178, cy: 170, avancement: 0.62, nom: 'Consolidation' },
];

const TRACE_DUREE = 1.6;
const VOYAGE_DUREE = 6;

export function RouteMap({ label }: { label: string }) {
  const reduit = useReducedMotion();

  return (
    <svg viewBox="0 0 360 200" role="img" aria-label={label} className="h-auto w-full">
      <defs>
        <linearGradient id="route-gradient" x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="var(--color-imperial)" />
          <stop offset="1" stopColor="var(--color-gold)" />
        </linearGradient>
        <radialGradient id="pulse-gradient">
          <stop offset="0" stopColor="var(--color-gold)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--color-gold)" stopOpacity="0" />
        </radialGradient>
        <pattern id="grid" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M18 0H0V18" fill="none" stroke="currentColor" strokeOpacity="0.07" />
        </pattern>
      </defs>

      <rect width="360" height="200" fill="url(#grid)" />

      {/* Route en pointillés : le chemin existe avant que la marchandise parte. */}
      <path d={ROUTE} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2" strokeDasharray="2 6" />

      {/* Le tracé se dessine depuis Guangzhou : l'œil part du bon côté. */}
      <m.path
        d={ROUTE}
        pathLength={1}
        fill="none"
        stroke="url(#route-gradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={reduit ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: TRACE_DUREE, ease: ease.out }}
      />

      {/* Escales : elles s'allument à l'instant où le colis les atteint. */}
      {ESCALES.map((escale) => (
        <m.circle
          key={escale.nom}
          cx={escale.cx}
          cy={escale.cy}
          r="3"
          fill="var(--color-charcoal)"
          stroke="var(--color-gold)"
          strokeWidth="1.5"
          initial={reduit ? false : { opacity: 0.25, r: 2 }}
          animate={reduit ? undefined : { opacity: [0.25, 1, 0.25], r: [2, 4, 3] }}
          transition={{
            duration: VOYAGE_DUREE,
            times: [escale.avancement - 0.08, escale.avancement, escale.avancement + 0.12],
            ease: ease.inOut,
            repeat: Number.POSITIVE_INFINITY,
            delay: TRACE_DUREE,
          }}
        />
      ))}

      {/* Départ : le point bat lentement, comme une usine qui tourne. */}
      <m.circle
        cx="300"
        cy="62"
        r="10"
        fill="url(#pulse-gradient)"
        initial={reduit ? false : { opacity: 0 }}
        animate={reduit ? undefined : { opacity: [0, 0.9, 0], scale: [0.6, 1.6, 0.6] }}
        style={{ transformOrigin: '300px 62px' }}
        transition={{ duration: 2.4, ease: ease.inOut, repeat: Number.POSITIVE_INFINITY }}
      />
      <circle cx="300" cy="62" r="6" fill="var(--color-imperial)" stroke="#fff" strokeWidth="2" />
      <text x="300" y="40" textAnchor="middle" className="fill-current text-[11px] font-semibold">
        Guangzhou
      </text>
      <text x="300" y="26" textAnchor="middle" className="fill-gold text-[10px]" aria-hidden>
        广州
      </text>

      {/* Arrivée : le point grossit une fois le tracé posé — la destination se confirme. */}
      <m.circle
        cx="58"
        cy="132"
        r="6"
        fill="var(--color-gold)"
        stroke="#fff"
        strokeWidth="2"
        initial={reduit ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{ transformOrigin: '58px 132px' }}
        transition={{ delay: TRACE_DUREE * 0.85, type: 'spring', stiffness: 320, damping: 15 }}
      />
      <text x="58" y="156" textAnchor="middle" className="fill-current text-[11px] font-semibold">
        Douala
      </text>

      {/* Le colis suit la route tracée. `offsetPath` garde le mouvement sur la courbe. */}
      {!reduit && (
        <m.g
          initial={{ offsetDistance: '0%', opacity: 0 }}
          animate={{ offsetDistance: '100%', opacity: [0, 1, 1, 0] }}
          transition={{
            duration: VOYAGE_DUREE,
            ease: 'linear',
            repeat: Number.POSITIVE_INFINITY,
            delay: TRACE_DUREE,
            opacity: {
              duration: VOYAGE_DUREE,
              times: [0, 0.06, 0.9, 1],
              repeat: Number.POSITIVE_INFINITY,
              delay: TRACE_DUREE,
            },
          }}
          style={{ offsetPath: `path("${ROUTE}")`, offsetRotate: '0deg' }}
        >
          <rect x="-6" y="-6" width="12" height="12" rx="2.5" fill="var(--color-gold)" stroke="var(--color-charcoal)" strokeWidth="1.5" />
          <path d="M-6 -1h12" stroke="var(--color-charcoal)" strokeWidth="1" opacity="0.5" />
        </m.g>
      )}
    </svg>
  );
}
