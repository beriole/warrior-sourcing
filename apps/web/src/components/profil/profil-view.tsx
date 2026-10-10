'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BUDGET_RANGES,
  IMPORTER_GOAL_LABELS,
  IMPORTER_LEVEL_LABELS,
  INTEREST_CATEGORY_LABELS,
  USER_ROLE_LABELS,
  type MeResponse,
  type UpdateMeRequest,
} from '@ws/contracts';
import { Badge, Button, Card, Skeleton } from '@ws/ui';
import { Bookmark, CreditCard, LifeBuoy, Pencil, RefreshCw, Ship, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { apiRequest } from '@/lib/api-fetcher';

const BUDGET_LABELS = new Map(
  BUDGET_RANGES.map((range) => [
    range.id,
    range.max === null
      ? `Plus de ${range.min.toLocaleString('fr-FR')} FCFA`
      : `${range.min.toLocaleString('fr-FR')} à ${range.max.toLocaleString('fr-FR')} FCFA`,
  ]),
);

/**
 * Profil du compte (§34, PRO-01 — première partie).
 *
 * Ce qui est modifiable ici l'est vraiment : le nom et le numéro. L'adresse email ne l'est
 * pas, parce qu'elle sert à se connecter et que la changer demanderait de prouver qu'on
 * possède la nouvelle — un parcours qui n'existe pas encore. Plutôt qu'un champ qui
 * échouerait, l'écran dit pourquoi.
 *
 * Les préférences d'importation ne sont pas dupliquées en formulaire : elles se modifient
 * là où elles ont été saisies, par l'onboarding, qui reste la seule définition de ces
 * questions.
 */
export function ProfilView() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch, isRefetching } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: ({ signal }) => apiRequest<MeResponse>('/v1/me', { signal }),
    retry: false,
  });

  /**
   * Brouillon d'édition : `null` tant qu'on ne modifie rien. Un seul état plutôt qu'un
   * drapeau et deux champs synchronisés par un effet — le formulaire est rempli au moment
   * où on l'ouvre, à partir de ce que le serveur vient de renvoyer.
   */
  const [brouillon, setBrouillon] = useState<{ name: string; phone: string } | null>(null);

  const enregistrer = useMutation<MeResponse, Error, UpdateMeRequest>({
    mutationFn: (body) => apiRequest<MeResponse>('/v1/me', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (reponse) => {
      queryClient.setQueryData(['me'], reponse);
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setBrouillon(null);
    },
  });

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6 md:px-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-52 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <Card className="text-center">
          <h1 className="font-display text-lg font-bold">Votre profil n’a pas pu être chargé</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Connectez-vous pour voir votre profil.'}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      </div>
    );
  }

  const { user, profile } = data;
  const sansNom = user.name.trim().length === 0;
  const initiales = user.name
    .replaceAll(/[^\p{L}]/gu, '')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <header className="flex items-center gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-night text-base font-bold text-white">
          {initiales || <UserRound className="size-6" aria-hidden />}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight">
            {sansNom ? 'Votre profil' : user.name}
          </h1>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </header>

      <Card className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Vos informations</h2>
          {brouillon === null && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBrouillon({ name: user.name, phone: user.phoneNumber ?? '' })}
            >
              <Pencil aria-hidden />
              Modifier
            </Button>
          )}
        </div>

        {brouillon !== null ? (
          <>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Nom</span>
              <input
                value={brouillon.name}
                maxLength={80}
                autoComplete="name"
                onChange={(event) => setBrouillon({ ...brouillon, name: event.target.value })}
                className="h-11 rounded-md border border-border bg-surface px-3 text-base outline-none focus-visible:border-primary"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Téléphone</span>
              <input
                value={brouillon.phone}
                inputMode="numeric"
                placeholder="6XXXXXXXX"
                onChange={(event) =>
                  setBrouillon({ ...brouillon, phone: event.target.value.replaceAll(/\D/g, '') })
                }
                className="figures h-11 rounded-md border border-border bg-surface px-3 text-base outline-none focus-visible:border-primary"
              />
              <span className="text-xs text-muted-foreground">
                Facultatif. Il sert à vous joindre sur une commande, et à pré-remplir le numéro à débiter.
                Laissez vide pour l’effacer.
              </span>
            </label>

            {enregistrer.isError && (
              <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
                {enregistrer.error instanceof Error
                  ? enregistrer.error.message
                  : 'L’enregistrement n’a pas abouti.'}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                loading={enregistrer.isPending}
                disabled={brouillon.name.trim().length < 2}
                onClick={() =>
                  enregistrer.mutate({
                    name: brouillon.name.trim(),
                    phoneNumber: brouillon.phone.trim() || null,
                  })
                }
              >
                Enregistrer
              </Button>
              <Button variant="outline" onClick={() => setBrouillon(null)}>
                Annuler
              </Button>
            </div>
          </>
        ) : (
          <dl className="grid gap-2 text-sm">
            <Ligne label="Nom">
              {sansNom ? <span className="text-muted-foreground">Pas encore renseigné</span> : user.name}
            </Ligne>
            <Ligne label="Téléphone">
              {user.phoneNumber ? (
                <span className="figures">{user.phoneNumber}</span>
              ) : (
                <span className="text-muted-foreground">Pas encore renseigné</span>
              )}
            </Ligne>
            <Ligne label="Adresse email">
              <span className="truncate">{user.email}</span>
            </Ligne>
            <Ligne label="Rôle">
              <Badge tone="neutral">{USER_ROLE_LABELS[user.role]}</Badge>
            </Ligne>
          </dl>
        )}

        <p className="text-xs text-muted-foreground">
          L’adresse email ne se modifie pas ici : c’est elle qui vous connecte. Écrivez-nous pour la changer.
        </p>
      </Card>

      <Card className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Vos préférences d’importation</h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/onboarding">
              <Pencil aria-hidden />
              Revoir mes réponses
            </Link>
          </Button>
        </div>

        {profile === null ? (
          <p className="text-sm text-muted-foreground">
            Vous n’avez pas encore répondu aux quatre questions. Elles servent à filtrer les opportunités
            réellement à votre portée.
          </p>
        ) : (
          <dl className="grid gap-2 text-sm">
            <Ligne label="Expérience">{IMPORTER_LEVEL_LABELS[profile.level]}</Ligne>
            <Ligne label="Objectifs">
              {profile.goals.map((goal) => IMPORTER_GOAL_LABELS[goal]).join(', ')}
            </Ligne>
            <Ligne label="Budget">{BUDGET_LABELS.get(profile.budgetRange) ?? profile.budgetRange}</Ligne>
            <Ligne label="Catégories">
              {profile.interests.map((interest) => INTEREST_CATEGORY_LABELS[interest]).join(', ')}
            </Ligne>
            <Ligne label="Ville">
              {profile.city ?? <span className="text-muted-foreground">Pas encore renseignée</span>}
            </Ligne>
          </dl>
        )}
      </Card>

      <Card className="grid gap-2">
        <h2 className="text-base font-semibold">Retrouver vos affaires</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Raccourci href="/abonnement" icon={CreditCard} label="Mon abonnement" />
          <Raccourci href="/favoris" icon={Bookmark} label="Mes favoris" />
          <Raccourci href="/importations" icon={Ship} label="Mes importations" />
          <Raccourci href="/services/demandes" icon={LifeBuoy} label="Mes demandes" />
        </div>
      </Card>
    </div>
  );
}

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}

function Raccourci({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Bookmark;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-muted"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {label}
    </Link>
  );
}
