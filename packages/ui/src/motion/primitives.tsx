'use client';

import { formatMoney, type Money as MoneyValue } from '@ws/contracts';
import { useReducedMotion, useSpring, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { duration, ease, spring } from './tokens';

/**
 * Gestes qui ont réellement besoin de JavaScript.
 *
 * Les entrées de page, elles, vivent en CSS (voir motion/entrance.tsx) : elles
 * doivent se produire même si le script n'est pas encore là. Ici on ne trouve que
 * ce qui dépend d'une valeur qui change, d'un doigt, ou d'une position partagée
 * entre deux écrans.
 */

/**
 * Chiffre qui compte jusqu'à sa valeur.
 *
 * Deux garde-fous : il part de la valeur précédente — une mise à jour ne repart
 * pas de zéro — et il se pose exactement sur la valeur demandée. Un montant qui
 * s'arrête à 246 999 au lieu de 247 000 est un bug, pas un effet.
 *
 * `depuis` sert au cas inverse : un chiffre de présentation qui doit **monter**
 * depuis zéro quand on arrive devant lui. Il change alors aussi le premier texte
 * rendu, sinon la valeur finale serait peinte une image avant que le décompte ne
 * reparte de zéro, et on verrait le chiffre sauter.
 */
export function Compteur({
  valeur,
  depuis,
  format,
  className,
}: {
  valeur: number;
  /** Valeur de départ du décompte. Par défaut : la valeur elle-même, donc aucun mouvement. */
  depuis?: number;
  format?: (valeur: number) => string;
  className?: string;
}) {
  const reduit = useReducedMotion();
  const afficher = format ?? ((v: number) => Math.round(v).toLocaleString('fr-FR'));

  const anime = useSpring(depuis ?? valeur, { stiffness: 120, damping: 24, mass: 0.7 });
  const texte = useTransform(anime, (v) => afficher(v));
  const [rendu, setRendu] = useState(() => afficher(depuis ?? valeur));

  useEffect(() => {
    if (reduit) {
      setRendu(afficher(valeur));
      return;
    }
    anime.set(valeur);
    const stop = texte.on('change', setRendu);
    return () => stop();
    // `afficher` est recréé à chaque rendu : le suivre relancerait l'animation pour rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur, reduit]);

  // Le rendu serveur affiche déjà la valeur : le compteur n'est qu'un enrichissement.
  return <span className={cn('figures tabular-nums', className)}>{reduit ? afficher(valeur) : rendu}</span>;
}

/**
 * Surface qui réagit au doigt : elle s'enfonce légèrement à l'appui, se soulève
 * au survol. Un accusé de réception, pas un effet.
 */
export function Pressable({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const reduit = useReducedMotion();

  if (reduit) {
    return (
      <div className={className} onClick={onClick}>
        {children}
      </div>
    );
  }

  return (
    <m.div
      className={className}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={spring.ui}
    >
      {children}
    </m.div>
  );
}

/**
 * Coche qui se dessine au lieu d'apparaître.
 * Le tracé dit « c'est fait » mieux qu'un symbole qui surgit.
 */
export function CocheTracee({ className, taille = 16 }: { className?: string; taille?: number }) {
  const reduit = useReducedMotion();

  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <m.path
        d="M20 6 9 17l-5-5"
        initial={reduit ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: duration.enter, ease: ease.out }}
      />
    </svg>
  );
}

/**
 * Halo lent derrière l'élément qu'on veut faire regarder.
 * Volontairement peu contrasté : il attire, il ne clignote pas.
 */
export function Halo({ className }: { className?: string }) {
  const reduit = useReducedMotion();
  if (reduit) return null;

  return (
    <m.span
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 rounded-[inherit]', className)}
      animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.02, 1] }}
      transition={{ duration: 3.6, ease: ease.inOut, repeat: Number.POSITIVE_INFINITY }}
    />
  );
}

/** Vrai pendant un court instant après qu'une valeur a changé : pour souligner une mise à jour. */
export function useVientDeChanger(valeur: unknown, ms = 900): boolean {
  const [actif, setActif] = useState(false);
  const premier = useRef(true);

  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    setActif(true);
    const timer = setTimeout(() => setActif(false), ms);
    return () => clearTimeout(timer);
  }, [valeur, ms]);

  return actif;
}

/**
 * Montant qui rejoint sa nouvelle valeur au lieu de la remplacer.
 *
 * Sur le calculateur, l'utilisateur modifie une quantité et voit le total se
 * déplacer : le mouvement dit que c'est bien son geste qui a produit le chiffre.
 * Réservé aux montants qui changent en direct — un montant figé qui s'anime au
 * chargement ne raconte rien et retarde la lecture.
 */
export function MontantAnime({ value, className }: { value: MoneyValue; className?: string }) {
  return (
    <Compteur
      valeur={value.amountMinor}
      format={(v) => formatMoney({ ...value, amountMinor: Math.round(v) })}
      className={cn('whitespace-nowrap', className)}
    />
  );
}
