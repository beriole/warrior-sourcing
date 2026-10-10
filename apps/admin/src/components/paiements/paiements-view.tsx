'use client';

import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  type AdminPaymentListResponse,
  type AdminPaymentResponse,
  type PaymentMethod,
  type PaymentStatus,
} from '@ws/contracts';
import { Badge, Button, Card, Money } from '@ws/ui';
import { Info, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { appelApi, dateHeure, etatDepuisErreur, xaf, type EtatAcces } from '@/components/admin/api';
import { ChampChoix } from '@/components/admin/champs';
import {
  EcranAcces,
  EnTete,
  EtatVide,
  MessageErreur,
  SqueletteListe,
} from '@/components/admin/etats';

function ton(status: PaymentStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'SUCCEEDED') return 'success';
  if (status === 'INITIATED' || status === 'PENDING') return 'warning';
  if (status === 'FAILED' || status === 'EXPIRED') return 'danger';
  return 'neutral';
}

const CIBLES: Record<AdminPaymentResponse['target'], string> = {
  ORDER: 'Commande',
  SERVICE_ORDER: 'Prestation',
  NONE: 'Sans objet lié',
};

/**
 * Paiements (ADM-06).
 *
 * Écran en lecture seule, et c'est volontaire : l'état d'un paiement vient de
 * l'agrégateur, qui seul sait si l'argent est arrivé. Un bouton « marquer comme payé »
 * serait le moyen le plus court d'expédier une commande que personne n'a réglée.
 */
export function PaiementsView() {
  const [data, setData] = useState<AdminPaymentListResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<EtatAcces>('ok');
  const [erreur, setErreur] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<PaymentStatus | ''>('');
  const [filtreMethode, setFiltreMethode] = useState<PaymentMethod | ''>('');
  const [criteres, setCriteres] = useState({
    recherche: '',
    statut: '' as PaymentStatus | '',
    methode: '' as PaymentMethod | '',
  });
  const [version, setVersion] = useState(0);

  const traiterErreur = useCallback((e: unknown) => {
    const etat = etatDepuisErreur(e);
    if (etat) setAcces(etat);
    else setErreur(e instanceof Error ? e.message : 'Une erreur inattendue s’est produite.');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (criteres.recherche) params.set('recherche', criteres.recherche);
    if (criteres.statut) params.set('statut', criteres.statut);
    if (criteres.methode) params.set('methode', criteres.methode);
    appelApi<AdminPaymentListResponse>(`/admin/payments?${params.toString()}`)
      .then((reponse) => {
        setData(reponse);
        setAcces('ok');
      })
      .catch(traiterErreur)
      .finally(() => setChargement(false));
  }, [criteres, version, traiterErreur]);

  function rafraichir() {
    setChargement(true);
    setVersion((v) => v + 1);
  }

  if (acces !== 'ok') {
    return <EcranAcces etat={acces} sujet="consulter les paiements" onReessayer={rafraichir} />;
  }

  return (
    <div className="grid gap-5">
      <EnTete
        titre="Paiements"
        sousTitre="En lecture seule : l’état d’un paiement vient de l’agrégateur, jamais d’une saisie."
      />

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Chiffre
            label="Réellement encaissé"
            valeur={<Money value={xaf(data.settledXaf)} />}
            note="Paiements confirmés, remboursements déduits. Les paiements en attente n’y figurent pas."
          />
          <Chiffre
            label="En attente de confirmation"
            valeur={<span className="figures">{data.pendingCount}</span>}
            note="Demandes envoyées, pas encore validées par le payeur."
          />
          <Chiffre
            label="Paiements enregistrés"
            valeur={<span className="figures">{data.total}</span>}
            note="Sur le filtre courant."
          />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid flex-1 gap-1 text-xs font-medium text-muted-foreground sm:max-w-sm">
          Rechercher
          <input
            value={recherche}
            placeholder="Référence, transaction, client"
            onChange={(event) => setRecherche(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter')
                setCriteres({ recherche, statut: filtreStatut, methode: filtreMethode });
            }}
            className="h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
          />
        </label>
        <ChampChoix
          label="État"
          value={filtreStatut}
          onChange={setFiltreStatut}
          vide="Tous"
          options={PAYMENT_STATUSES.map((statut) => ({ value: statut, label: PAYMENT_STATUS_LABELS[statut] }))}
        />
        <ChampChoix
          label="Moyen"
          value={filtreMethode}
          onChange={setFiltreMethode}
          vide="Tous"
          options={PAYMENT_METHODS.map((methode) => ({
            value: methode,
            label: PAYMENT_METHOD_LABELS[methode],
          }))}
        />
        <Button
          variant="outline"
          onClick={() => setCriteres({ recherche, statut: filtreStatut, methode: filtreMethode })}
        >
          <Search aria-hidden />
          Filtrer
        </Button>
      </div>

      {erreur && <MessageErreur>{erreur}</MessageErreur>}

      {chargement ? (
        <SqueletteListe />
      ) : !data || data.items.length === 0 ? (
        <EtatVide
          titre="Aucun paiement ne correspond"
          explication="Modifiez la recherche, ou retirez un filtre."
        />
      ) : (
        <ul className="grid gap-2">
          {data.items.map((paiement) => (
            <li key={paiement.reference} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="figures font-semibold">{paiement.reference}</span>
                <Badge tone={ton(paiement.status)}>{paiement.statusLabel}</Badge>
                <Badge tone="neutral">{paiement.methodLabel}</Badge>
                <span className="figures ml-auto font-semibold">
                  <Money value={xaf(paiement.amountXaf)} />
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                {paiement.customerName || paiement.customerEmail} · {CIBLES[paiement.target]}
                {paiement.targetReference && ` ${paiement.targetReference}`} · créé le{' '}
                {dateHeure(paiement.createdAt)}
                {paiement.paidAt && ` · payé le ${dateHeure(paiement.paidAt)}`}
              </p>

              <p className="figures mt-0.5 text-xs text-muted-foreground">
                {paiement.provider}
                {paiement.providerRef && ` · ${paiement.providerRef}`}
                {paiement.payerPhone && ` · ${paiement.payerPhone}`}
                {paiement.refundedXaf > 0 && (
                  <>
                    {' · remboursé '}
                    <Money value={xaf(paiement.refundedXaf)} />
                  </>
                )}
              </p>

              {paiement.failureReason && (
                <p className="mt-1 text-xs text-danger">{paiement.failureReason}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Un paiement resté « en attente » n’est pas perdu : il est relu auprès de l’agrégateur, et expire
          de lui-même si le payeur ne le valide pas.
        </p>
      )}
    </div>
  );
}

function Chiffre({
  label,
  valeur,
  note,
}: {
  label: string;
  valeur: React.ReactNode;
  note: string;
}) {
  return (
    <Card>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="figures mt-1 text-xl font-bold">{valeur}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </Card>
  );
}
