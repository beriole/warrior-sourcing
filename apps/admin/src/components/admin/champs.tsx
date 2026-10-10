'use client';

import type { ReactNode } from 'react';

/**
 * Champs de formulaire du back-office.
 *
 * Ils tiennent dans une grille étroite et gardent la même hauteur de frappe partout :
 * un back-office se remplit vite, au clavier, souvent sur un écran partagé avec autre
 * chose. `min-w-0` évite qu'un champ pousse sa colonne hors du cadre.
 */

const SAISIE =
  'h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus-visible:border-primary';

export function Champ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  requis = false,
  aide,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'date' | 'url';
  placeholder?: string;
  requis?: boolean;
  /** Une ligne sous le champ : à quoi sert cette valeur, ou d'où elle doit venir. */
  aide?: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        type={type}
        value={value}
        required={requis}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={SAISIE}
      />
      {aide && <span className="text-[11px] font-normal text-muted-foreground">{aide}</span>}
    </label>
  );
}

export function ChampNombre({
  label,
  value,
  onChange,
  min = 0,
  aide,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  aide?: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        step={1}
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))}
        className={`figures ${SAISIE}`}
      />
      {aide && <span className="text-[11px] font-normal text-muted-foreground">{aide}</span>}
    </label>
  );
}

export function ChampTexte({
  label,
  value,
  onChange,
  lignes = 4,
  placeholder,
  aide,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  lignes?: number;
  placeholder?: string;
  aide?: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <textarea
        value={value}
        rows={lignes}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
      />
      {aide && <span className="text-[11px] font-normal text-muted-foreground">{aide}</span>}
    </label>
  );
}

/**
 * Liste déroulante. `vide` permet un choix « non renseigné » explicite : en back-office,
 * l'absence de valeur est une information, pas un oubli à masquer par une valeur par défaut.
 */
export function ChampChoix<T extends string>({
  label,
  value,
  onChange,
  options,
  vide,
  aide,
}: {
  label: string;
  value: T | '';
  onChange: (value: T | '') => void;
  options: { value: T; label: string }[];
  vide?: string;
  aide?: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T | '')}
        className={SAISIE}
      >
        {vide !== undefined && <option value="">{vide}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {aide && <span className="text-[11px] font-normal text-muted-foreground">{aide}</span>}
    </label>
  );
}

/** Groupe de champs avec son intitulé : sépare les sujets d'un formulaire long. */
export function Section({
  titre,
  description,
  children,
}: {
  titre: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h3 className="text-sm font-semibold">{titre}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
