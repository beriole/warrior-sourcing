'use client';

import { ImageOff } from 'lucide-react';
import { useState } from 'react';

/**
 * Vignette d'une image distante, dans le back-office.
 *
 * Une adresse d'image peut être morte : fichier retiré, hébergeur coupé, lien recopié de
 * travers. Le navigateur affiche alors sa propre icône cassée, qui ressemble à un bogue de
 * l'application et ne dit rien d'utile.
 *
 * Ici, l'échec est traité comme une information : on affiche « image introuvable », et la
 * personne qui gère la fiche sait quoi faire. C'est le seul endroit où cette distinction
 * compte vraiment — côté public, une image absente est simplement absente.
 */
export function Vignette({ url, taille = 'size-14' }: { url: string; taille?: string }) {
  const [echec, setEchec] = useState(false);

  if (echec) {
    return (
      <span
        title="L’adresse de cette image ne répond pas."
        className={`flex ${taille} shrink-0 flex-col items-center justify-center gap-0.5 rounded border border-dashed border-border bg-surface-muted text-[9px] leading-tight text-muted-foreground`}
      >
        <ImageOff className="size-4" aria-hidden />
        introuvable
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- source distante, sans optimiseur
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setEchec(true)}
      className={`${taille} shrink-0 rounded object-cover`}
    />
  );
}
