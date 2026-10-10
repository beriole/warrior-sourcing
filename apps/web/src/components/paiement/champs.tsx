'use client';

import { CHECKOUT_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type CheckoutPaymentMethod } from '@ws/contracts';
import type { ReactNode } from 'react';
import { formatLocalPhone } from '@/lib/phone';

/**
 * Briques communes aux deux encaissements : abonnement et formation à l'unité.
 *
 * Elles existent parce que les deux écrans demandent exactement la même chose — un nom,
 * une adresse, un numéro Mobile Money, un opérateur — et que deux copies finiraient par
 * valider différemment le même numéro. Le jour où l'une accepterait huit chiffres,
 * personne ne saurait laquelle a raison.
 */

const CHAMP =
  'h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary';

export function Champ({
  label,
  htmlFor,
  aide,
  children,
}: {
  label: string;
  htmlFor: string;
  aide?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1 text-sm">
      <label htmlFor={htmlFor} className="font-medium">
        {label}
      </label>
      {children}
      {aide && (
        <p id={`${htmlFor}-aide`} className="text-xs text-muted-foreground">
          {aide}
        </p>
      )}
    </div>
  );
}

/** Nom et adresse électronique : ce qui crée le compte quand il n'y en a pas encore. */
export function ChampsIdentite({
  prefixe,
  nom,
  email,
  onNom,
  onEmail,
}: {
  prefixe: string;
  nom: string;
  email: string;
  onNom: (valeur: string) => void;
  onEmail: (valeur: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Champ label="Votre nom" htmlFor={`${prefixe}-nom`}>
        <input
          id={`${prefixe}-nom`}
          value={nom}
          maxLength={80}
          autoComplete="name"
          onChange={(event) => onNom(event.target.value)}
          className={CHAMP}
        />
      </Champ>
      <Champ
        label="Votre adresse électronique"
        htmlFor={`${prefixe}-email`}
        aide="C’est à cette adresse que partent vos identifiants."
      >
        <input
          id={`${prefixe}-email`}
          type="email"
          inputMode="email"
          value={email}
          maxLength={120}
          autoComplete="email"
          aria-describedby={`${prefixe}-email-aide`}
          onChange={(event) => onEmail(event.target.value)}
          className={CHAMP}
        />
      </Champ>
    </div>
  );
}

/**
 * Numéro Mobile Money.
 *
 * L'indicatif est affiché à part et jamais saisi : c'est la forme que les gens ont sous
 * les yeux sur leur téléphone, et elle enlève la question « avec ou sans +237 ? ».
 */
export function ChampTelephone({
  prefixe,
  valeur,
  onChange,
}: {
  prefixe: string;
  valeur: string;
  onChange: (valeur: string) => void;
}) {
  return (
    <Champ
      label="Numéro Mobile Money à débiter"
      htmlFor={`${prefixe}-telephone`}
      aide="9 chiffres, commençant par 6. C’est sur ce numéro que la demande arrive."
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="figures inline-flex h-11 shrink-0 items-center rounded-md border border-border bg-surface-muted px-3 text-sm font-semibold">
          +237
        </span>
        <input
          id={`${prefixe}-telephone`}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={formatLocalPhone(valeur)}
          placeholder="6 70 11 22 33"
          aria-describedby={`${prefixe}-telephone-aide`}
          onChange={(event) => onChange(event.target.value)}
          className={`figures ${CHAMP}`}
        />
      </div>
    </Champ>
  );
}

/** Choix de l'opérateur. Deux boutons plutôt qu'une liste : c'est un choix, pas un réglage. */
export function ChoixOperateur({
  valeur,
  onChange,
}: {
  valeur: CheckoutPaymentMethod;
  onChange: (methode: CheckoutPaymentMethod) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHECKOUT_PAYMENT_METHODS.map((methode) => (
        <button
          key={methode}
          type="button"
          onClick={() => onChange(methode)}
          aria-pressed={valeur === methode}
          className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
            valeur === methode
              ? 'border-primary bg-imperial-soft'
              : 'border-border bg-surface hover:bg-surface-muted'
          }`}
        >
          {PAYMENT_METHOD_LABELS[methode]}
        </button>
      ))}
    </div>
  );
}
