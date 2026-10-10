'use client';

import { useQuery } from '@tanstack/react-query';
import type { ShippingAddress, ShippingAddressResponse } from '@ws/contracts';
import { Badge, Button, Card, Entree, Skeleton } from '@ws/ui';
import { AlertTriangle, Check, Copy, MessageSquare, Package, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { apiRequest } from '@/lib/api-fetcher';

/**
 * Assistant d'adresse d'expédition (§25).
 *
 * Il répond à la question de la première commande : « qu'est-ce que je donne comme adresse
 * à mon fournisseur ? ». Deux erreurs coûtent cher et reviennent sans cesse — donner son
 * adresse camerounaise, ce qui fait partir la marchandise en express ; ou donner l'adresse
 * de l'entrepôt sans son code client, ce qui fait arriver un carton que personne ne peut
 * rattacher à son propriétaire.
 *
 * Rien n'est engendré ici, et c'est délibéré. L'adresse vient du transitaire saisi en
 * back-office, le code client vient du compte. Un assistant qui improviserait une adresse
 * plausible enverrait une marchandise nulle part — et le texte serait d'autant plus
 * convaincant qu'il serait faux.
 */
export function AssistantAdresse() {
  const { data, isPending, isError, error, refetch, isRefetching } = useQuery<ShippingAddressResponse>({
    queryKey: ['adresse-expedition'],
    queryFn: ({ signal }) => apiRequest<ShippingAddressResponse>('/v1/cargo/adresse-expedition', { signal }),
  });

  const [choisi, setChoisi] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6 md:px-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <Card className="text-center">
          <h1 className="font-display text-lg font-bold">L’assistant n’a pas pu se charger</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.'}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      </div>
    );
  }

  const adresse = data.addresses.find((item) => item.forwarderId === choisi) ?? null;

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Entree geste="paragraphe" as="header">
        <h1 className="font-display text-2xl font-bold tracking-tight">Quelle adresse donner à mon fournisseur ?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre fournisseur chinois n’envoie pas la marchandise chez vous. Il l’envoie à l’entrepôt de
          groupage en Chine, qui la rassemble avec d’autres et l’expédie vers le Cameroun.
        </p>
      </Entree>

      {/* ── Le code client, d'abord : c'est lui qui rattache un carton à un compte ── */}
      <Message auteur="assistant" delai={0}>
        <p>
          Voici votre <strong>code client</strong>. Il vous suit pour toutes vos commandes.
        </p>
        <p className="mt-3">
          <span className="figures rounded-md border border-gold/40 bg-gold-soft px-3 py-1.5 text-lg font-bold tracking-widest text-gold-ink">
            {data.clientCode}
          </span>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Il doit figurer sur l’étiquette <em>et</em> sur les cartons. Sans lui, votre colis arrive à
          l’entrepôt sans propriétaire identifiable.
        </p>
      </Message>

      {data.addresses.length === 0 ? (
        <Message auteur="assistant" delai={0.12}>
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span>
              Aucune adresse d’entrepôt n’est encore enregistrée. Nous ne vous en proposons pas
              d’approximative : une adresse inventée fait partir une marchandise nulle part.
            </span>
          </p>
          <p className="mt-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/messages">Demander l’adresse à notre équipe</Link>
            </Button>
          </p>
        </Message>
      ) : (
        <>
          <Message auteur="assistant" delai={0.12}>
            <p>Par quel transitaire passez-vous ?</p>
            <div className="mt-3 grid gap-2">
              {data.addresses.map((item) => (
                <button
                  key={item.forwarderId}
                  type="button"
                  onClick={() => setChoisi(item.forwarderId)}
                  aria-pressed={choisi === item.forwarderId}
                  className={`ws-eleve rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    choisi === item.forwarderId
                      ? 'border-primary bg-imperial-soft'
                      : 'border-border bg-surface hover:bg-surface-muted'
                  }`}
                >
                  <span className="block font-semibold">{item.warehouseName}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {item.modeLabels.map((mode) => (
                      <Badge key={mode} tone="neutral">
                        {mode}
                      </Badge>
                    ))}
                    {item.cities.length > 0 && <span>Livre à {item.cities.join(', ')}</span>}
                  </span>
                </button>
              ))}
            </div>
          </Message>

          {adresse && <BlocAdresse adresse={adresse} />}
        </>
      )}

      {/* ── Les pièges, dans l'ordre où ils surviennent ── */}
      <Message auteur="assistant" delai={0.2}>
        <p className="font-semibold">Les erreurs qui coûtent le plus cher</p>
        <ul className="mt-3 grid gap-3">
          {data.mistakes.map((erreur) => (
            <li key={erreur.titre} className="border-l-2 border-danger/40 pl-3">
              <p className="font-medium">{erreur.titre}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{erreur.consequence}</p>
              <p className="mt-1 text-sm">
                <Check className="mr-1 inline size-3.5 text-success" aria-hidden />
                {erreur.aFaire}
              </p>
            </li>
          ))}
        </ul>
      </Message>

      <p className="text-center text-sm text-muted-foreground">
        Une situation qui n’est pas décrite ici ?{' '}
        <Link href="/messages" className="font-medium text-primary hover:underline">
          Écrivez-nous
        </Link>
        {' '}: nous répondons avec votre dossier sous les yeux.
      </p>
    </div>
  );
}

/** Le bloc à coller, et un bouton qui le copie réellement. */
function BlocAdresse({ adresse }: { adresse: ShippingAddress }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(adresse.copyBlock);
      setCopie(true);
      setTimeout(() => setCopie(false), 2200);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le texte reste
      // sélectionnable à la main, et on ne prétend pas avoir copié.
      setCopie(false);
    }
  }

  return (
    <Message auteur="assistant" delai={0}>
      <p>
        Collez ceci à votre fournisseur, <strong>sans le retaper</strong> et sans le traduire.
      </p>

      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-surface-muted p-3 text-sm">
        {adresse.copyBlock}
      </pre>

      <div className="mt-3">
        <Button size="sm" onClick={() => void copier()}>
          {copie ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copie ? 'Copié' : 'Copier le bloc'}
        </Button>
      </div>

      <dl className="mt-4 grid gap-3">
        {adresse.fields.map((champ) => (
          <div key={champ.label} className="border-l-2 border-border pl-3">
            <dt className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {champ.label}
              <span className="text-muted-foreground">— {champ.labelFr}</span>
              {champ.critique && <Badge tone="warning">Indispensable</Badge>}
            </dt>
            <dd className="mt-0.5 text-sm text-muted-foreground">{champ.why}</dd>
          </div>
        ))}
      </dl>

      {adresse.instructions && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{adresse.instructions}</span>
        </p>
      )}
    </Message>
  );
}

/**
 * Une bulle de l'échange.
 *
 * L'allure de conversation est voulue : on répond à une question qu'on se pose, dans
 * l'ordre où on se la pose. Ce n'est pas un modèle de langue, et l'écran ne le laisse
 * pas croire — il ne propose aucun champ de saisie libre, seulement des choix.
 */
function Message({
  auteur,
  delai,
  children,
}: {
  auteur: 'assistant';
  delai: number;
  children: ReactNode;
}) {
  return (
    <Entree geste="carte" delai={delai}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-imperial-soft text-imperial"
        >
          <MessageSquare className="size-4" />
        </span>
        <Card className="min-w-0 flex-1">
          <span className="sr-only">{auteur === 'assistant' ? 'Assistant :' : ''}</span>
          {children}
        </Card>
      </div>
    </Entree>
  );
}
