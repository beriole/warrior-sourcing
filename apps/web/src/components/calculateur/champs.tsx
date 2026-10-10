'use client';

import type { ReactNode } from 'react';

/**
 * Champs du calculateur : zones tactiles d'au moins 44 px, clavier numérique sur mobile,
 * libellés explicites et unité toujours visible (§44, §46).
 */

export function ChampNombre({
  id,
  label,
  value,
  onChange,
  suffixe,
  aide,
  min = 0,
  max,
  pas = 1,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffixe?: string;
  aide?: string;
  min?: number;
  max?: number;
  pas?: number;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center rounded-md border border-border bg-surface focus-within:border-primary">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={pas}
          onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))}
          className="figures h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
        />
        {suffixe && (
          <span className="shrink-0 px-3 text-xs font-medium text-muted-foreground">{suffixe}</span>
        )}
      </div>
      {aide && <p className="text-xs text-muted-foreground">{aide}</p>}
    </div>
  );
}

export function ChampTexte({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
      />
    </div>
  );
}

/** Choix unique présenté en pastilles : plus rapide au pouce qu'une liste déroulante. */
export function Pastille({
  children,
  selected,
  onClick,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
        selected
          ? 'border-primary bg-primary text-white'
          : 'border-border bg-surface hover:bg-surface-muted'
      }`}
    >
      {children}
    </button>
  );
}

/** Choix unique en ligne pleine largeur, avec une explication sous le libellé. */
export function Option({
  titre,
  description,
  selected,
  onClick,
}: {
  titre: string;
  description?: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-12 rounded-md border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-primary bg-imperial-soft'
          : 'border-border bg-surface hover:bg-surface-muted'
      }`}
    >
      <span className="block text-sm font-semibold">{titre}</span>
      {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
    </button>
  );
}

export function Section({ titre, aide, children }: { titre: string; aide?: string; children: ReactNode }) {
  return (
    <div className="grid gap-3">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">{titre}</h2>
        {aide && <p className="mt-1 text-sm text-muted-foreground">{aide}</p>}
      </div>
      {children}
    </div>
  );
}
