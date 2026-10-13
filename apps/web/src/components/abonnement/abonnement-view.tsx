'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SUBSCRIPTION_RIGHT_LABELS,
  type CheckoutPaymentMethod,
  type MySubscriptionResponse,
  type PublicSubscribeRequest,
  type PublicSubscribeResponse,
  type SubscribeRequest,
  type SubscriptionPlan,
  type SubscriptionPlansResponse,
} from '@ws/contracts';
import { Badge, Button, Card, ConditionsPromotion, Entree, Prix, Skeleton } from '@ws/ui';
import { Check, RefreshCw, Tag } from 'lucide-react';
import Link from 'next/link';
import { aMettreEnAvant, CarteOffre } from './carte-offre';
import { useState } from 'react';
import { ChampsIdentite, ChampTelephone, ChoixOperateur } from '@/components/paiement/champs';
import { SuiviPaiement, type Lancement } from '@/components/paiement/suivi';
import { apiRequest } from '@/lib/api-fetcher';
import { isValidLocalPhone } from '@/lib/phone';

/**
 * Offres d'abonnement (§43, SUB-01).
 *
 * Le paywall dit ce qu'on obtient, pas ce qu'on rate : chaque offre liste ses avantages
 * réels, et aucune ne cache une information de risque — un incident fournisseur reste
 * visible d'un compte gratuit, abonnement ou non.
 *
 * Le prix affiché vient du serveur, remise comprise. L'écran ne recalcule rien : c'est la
 * seule façon d'être sûr que le montant annoncé est celui qui sera débité.
 *
 * Un même écran sert deux parcours. Connecté, on souscrit depuis son compte ; sans
 * session, on souscrit en donnant nom, adresse et numéro, et le compte est créé par le
 * paiement. Deux écrans séparés finiraient par afficher deux prix.
 */
export function AbonnementView() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [codeApplique, setCodeApplique] = useState('');
  const [choisie, setChoisie] = useState<string | null>(null);
  /** Paiement lancé : tant qu'il est là, l'écran suit sa confirmation. */
  const [enCours, setEnCours] = useState<Lancement | null>(null);

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery<SubscriptionPlansResponse>({
    queryKey: ['offres', codeApplique],
    queryFn: ({ signal }) =>
      apiRequest<SubscriptionPlansResponse>(
        `/v1/offres${codeApplique ? `?code=${encodeURIComponent(codeApplique)}` : ''}`,
        { signal },
      ),
  });

  const resilier = useMutation<MySubscriptionResponse, Error, void>({
    mutationFn: () => apiRequest<MySubscriptionResponse>('/v1/mon-abonnement/resiliation', { method: 'PATCH' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['offres'] });
    },
  });

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6 md:px-6">
        <Skeleton className="h-10 w-1/2" />
        <div className="grid gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-80 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <Card className="text-center">
          <h1 className="font-display text-lg font-bold">Les offres n’ont pas pu être chargées</h1>
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

  const mine = data.mine;
  const connecte = mine !== null;
  const offreChoisie = data.plans.find((plan) => plan.slug === choisie) ?? null;
  // Même règle que sur l'accueil, et au même endroit : les deux écrans doivent recommander
  // la même offre, sinon le visiteur voit la plateforme se contredire en un clic.
  const enAvant = aMettreEnAvant(data.plans.filter((plan) => plan.active));

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Entree geste="paragraphe" as="header">
        <h1 className="font-display text-2xl font-bold tracking-tight">Abonnement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce que chaque formule ouvre réellement. Rien n’est masqué derrière un abonnement s’il s’agit d’une
          information de risque : un incident fournisseur reste visible de tous.
        </p>
      </Entree>

      {mine?.subscription && (
        <Card className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Votre offre : {mine.planName}</span>
            <Badge tone={mine.subscription.current ? 'success' : 'warning'}>
              {mine.subscription.statusLabel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {mine.subscription.current
              ? `Vos droits sont ouverts jusqu’au ${new Date(mine.subscription.endsAt).toLocaleDateString('fr-FR')}.`
              : 'Aucun droit n’est ouvert en ce moment.'}
          </p>
          {mine.subscription.current && mine.subscription.status === 'ACTIVE' && (
            <div>
              <Button variant="outline" size="sm" loading={resilier.isPending} onClick={() => resilier.mutate()}>
                Résilier
              </Button>
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid flex-1 gap-1 text-sm sm:max-w-xs">
          <span className="font-medium">Vous avez un code promotionnel ?</span>
          <input
            value={code}
            maxLength={24}
            placeholder="RENTREE25"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setCodeApplique(code.trim());
            }}
            className="h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
          />
        </label>
        <Button variant="outline" onClick={() => setCodeApplique(code.trim())}>
          <Tag aria-hidden />
          Appliquer
        </Button>
      </div>

      {codeApplique && !data.plans.some((plan) => plan.priced.promotionCode === codeApplique) && (
        <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
          Le code « {codeApplique} » ne s’applique à aucune de ces offres. Il concerne peut-être une
          formation : essayez-le depuis sa fiche.
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {data.plans.map((plan) => (
          <OffreCarte
            key={plan.id}
            plan={plan}
            actuelle={mine?.planSlug === plan.slug && (mine?.subscription?.current ?? false)}
            choisie={choisie === plan.slug}
            enAvant={plan.id === enAvant}
            libelleEnAvant="Le plus complet"
            connecte={connecte}
            onChoisir={() => {
              setChoisie(plan.slug);
              setEnCours(null);
            }}
          />
        ))}
      </div>

      {enCours ? (
        <SuiviPaiement
          lancement={enCours}
          // Ciblé : sans clé, l'invalidation relancerait aussi la requête d'état du
          // paiement, qui rappellerait cette fonction — une boucle sans fin.
          onTermine={() => void queryClient.invalidateQueries({ queryKey: ['offres'] })}
        />
      ) : offreChoisie ? (
        <FormulaireSouscription
          plan={offreChoisie}
          connecte={connecte}
          promotionCode={codeApplique || null}
          onAnnuler={() => setChoisie(null)}
          onLance={(lancement) => {
            setChoisie(null);
            setEnCours(lancement);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Carte d'offre de la page d'abonnement : la carte partagée, avec les actions d'ici.
 *
 * L'offre déjà souscrite montre un bouton éteint plutôt que de disparaître — on doit
 * pouvoir comparer ce qu'on a avec ce qu'on pourrait prendre.
 */
function OffreCarte({
  plan,
  actuelle,
  choisie,
  connecte,
  libelleEnAvant,
  enAvant,
  onChoisir,
}: {
  plan: SubscriptionPlan;
  actuelle: boolean;
  choisie: boolean;
  connecte: boolean;
  libelleEnAvant: string;
  enAvant: boolean;
  onChoisir: () => void;
}) {
  return (
    <div className={choisie ? 'rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background' : undefined}>
      <CarteOffre
        plan={plan}
        enAvant={enAvant}
        libelleEnAvant={libelleEnAvant}
        badge={actuelle ? <Badge tone="success">Votre offre</Badge> : undefined}
        action={
          actuelle ? (
            <Button block variant="outline" disabled>
              Offre en cours
            </Button>
          ) : plan.priceXaf === 0 ? (
            // L'offre gratuite est l'offre par défaut : il n'y a rien à souscrire. Proposer
            // de l'« activer » ferait croire à une action utile ; créer un compte, si.
            connecte ? (
              <p className="text-center text-sm text-muted-foreground">
                Rien à souscrire : c’est l’offre par défaut.
              </p>
            ) : (
              <Button asChild block variant="outline">
                <Link href="/connexion">Créer mon compte</Link>
              </Button>
            )
          ) : (
            <Button block variant={enAvant ? 'gold' : 'primary'} onClick={onChoisir}>
              Choisir {plan.name}
            </Button>
          )
        }
      />
    </div>
  );
}

/**
 * Formulaire de souscription.
 *
 * Le numéro Mobile Money est **obligatoire** dès qu'il y a quelque chose à encaisser :
 * la demande de paiement part sur ce numéro, et un compte créé par code courriel n'en
 * possède aucun. Il était auparavant absent de cet écran, et la souscription échouait
 * côté agrégateur sans que personne ne sache pourquoi.
 *
 * Sans session, on demande en plus le nom et l'adresse électronique : ce sont eux qui
 * créent le compte, et l'adresse qui recevra les identifiants.
 */
function FormulaireSouscription({
  plan,
  connecte,
  promotionCode,
  onAnnuler,
  onLance,
}: {
  plan: SubscriptionPlan;
  connecte: boolean;
  promotionCode: string | null;
  onAnnuler: () => void;
  onLance: (lancement: Lancement) => void;
}) {
  const gratuite = plan.priced.finalXaf === 0;
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('MTN_MOMO');

  const souscrire = useMutation<Lancement, Error, void>({
    mutationFn: async () => {
      if (connecte) {
        const reponse = await apiRequest<{ subscription: unknown; paymentReference: string | null }>(
          '/v1/mon-abonnement',
          {
            method: 'POST',
            body: JSON.stringify({
              planSlug: plan.slug,
              promotionCode,
              paymentMethod,
              ...(gratuite ? {} : { payerPhone: telephone.replaceAll(/\D/g, '') }),
            } satisfies SubscribeRequest),
          },
        );
        return {
          paymentReference: reponse.paymentReference,
          email: null,
          accountCreated: false,
          nextStep: reponse.paymentReference
            ? 'Une demande de paiement a été envoyée sur votre téléphone. Validez-la avec votre code secret.'
            : 'Votre offre est ouverte.',
          libelle: `offre ${plan.name}`,
        };
      }

      const reponse = await apiRequest<PublicSubscribeResponse>('/v1/offres/souscription', {
        method: 'POST',
        body: JSON.stringify({
          planSlug: plan.slug,
          fullName: nom.trim(),
          email: email.trim(),
          payerPhone: telephone.replaceAll(/\D/g, ''),
          paymentMethod,
          promotionCode,
        } satisfies PublicSubscribeRequest),
      });
      return {
        paymentReference: reponse.paymentReference,
        email: reponse.email,
        accountCreated: reponse.accountCreated,
        nextStep: reponse.nextStep,
        libelle: `offre ${plan.name}`,
      };
    },
    onSuccess: onLance,
  });

  // Le numéro reste exigé même pour une offre gratuite souscrite sans compte : c'est
  // la seule coordonnée qui permette de rappeler quelqu'un, et le serveur la demande.
  const numeroRequis = !connecte || !gratuite;
  const complet =
    (connecte || (nom.trim().length >= 2 && /.+@.+\..+/.test(email.trim()))) &&
    (!numeroRequis || isValidLocalPhone(telephone));

  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="text-base font-semibold">
          {gratuite ? `Activer l’offre ${plan.name}` : `Payer l’offre ${plan.name}`}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {gratuite
            ? 'Rien à encaisser : vos droits s’ouvrent immédiatement.'
            : 'La demande de paiement part sur votre téléphone. Vos droits s’ouvrent dès la confirmation, pas avant.'}
        </p>
      </div>

      {!connecte && (
        <>
          <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
            Pas encore de compte ? Il est créé avec ce paiement, et vos identifiants de connexion vous
            sont envoyés par courriel dès la confirmation.
          </p>
          <ChampsIdentite prefixe="souscription" nom={nom} email={email} onNom={setNom} onEmail={setEmail} />
        </>
      )}

      {numeroRequis && (
        <ChampTelephone prefixe="souscription" valeur={telephone} onChange={setTelephone} />
      )}

      {!gratuite && <ChoixOperateur valeur={paymentMethod} onChange={setPaymentMethod} />}

      {souscrire.isError && (
        <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {souscrire.error instanceof Error ? souscrire.error.message : 'La souscription n’a pas abouti.'}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button loading={souscrire.isPending} disabled={!complet} onClick={() => souscrire.mutate()}>
          {gratuite ? 'Activer' : 'Confirmer et payer'}
        </Button>
        <Button variant="outline" onClick={onAnnuler}>
          Annuler
        </Button>
      </div>
    </Card>
  );
}
