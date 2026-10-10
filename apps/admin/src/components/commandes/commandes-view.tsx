'use client';

import {
  DELIVERY_MODE_LABELS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SHIPMENT_STAGE_LABELS,
  type AdminOrderDetailResponse,
  type AdminOrderListResponse,
  type AdminOrderResponse,
  type OrderStatus,
} from '@ws/contracts';
import { Badge, Button, Card, Money } from '@ws/ui';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { appelApi, dateCourte, dateHeure, etatDepuisErreur, xaf, type EtatAcces } from '@/components/admin/api';
import { EcranAcces, EnTete, EtatVide, MessageErreur, MessageInfo, SqueletteListe } from '@/components/admin/etats';

function tonEtat(statut: OrderStatus) {
  if (statut === 'PAID') return 'success' as const;
  if (statut === 'CANCELLED') return 'danger' as const;
  return 'warning' as const;
}

/**
 * Gestion des commandes (ADM-06).
 *
 * Le serveur seul décide des changements d'état possibles : l'écran n'affiche que les
 * transitions qu'il a renvoyées, et un motif est exigé à chaque fois (journal d'audit).
 */
export function CommandesView() {
  const [liste, setListe] = useState<AdminOrderResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<AdminOrderDetailResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<EtatAcces>('ok');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<OrderStatus | ''>('');
  const [criteres, setCriteres] = useState({ recherche: '', statut: '' as OrderStatus | '' });
  const [version, setVersion] = useState(0);

  const [nouvelEtat, setNouvelEtat] = useState<OrderStatus | ''>('');
  const [motif, setMotif] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  const traiterErreur = useCallback((e: unknown) => {
    const etat = etatDepuisErreur(e);
    if (etat) setAcces(etat);
    else setErreur(e instanceof Error ? e.message : 'Une erreur inattendue s’est produite.');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (criteres.recherche) params.set('recherche', criteres.recherche);
    if (criteres.statut) params.set('statut', criteres.statut);
    appelApi<AdminOrderListResponse>(`/admin/orders?${params.toString()}`)
      .then((data) => {
        setListe(data.orders);
        setTotal(data.total);
        setAcces('ok');
      })
      .catch(traiterErreur)
      .finally(() => setChargement(false));
  }, [criteres, version, traiterErreur]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  const ouvrirDetail = useCallback(
    async (id: string) => {
      setErreur(null);
      setInfo(null);
      try {
        const data = await appelApi<AdminOrderDetailResponse>(`/admin/orders/${id}`);
        setDetail(data);
        setNouvelEtat(data.allowedStatuses[0] ?? '');
        setMotif('');
      } catch (e) {
        traiterErreur(e);
      }
    },
    [traiterErreur],
  );

  async function changerEtat() {
    if (!detail || !nouvelEtat) return;
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const data = await appelApi<AdminOrderDetailResponse>(`/admin/orders/${detail.order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nouvelEtat, reason: motif.trim() }),
      });
      setDetail(data);
      setNouvelEtat(data.allowedStatuses[0] ?? '');
      setMotif('');
      setInfo(
        `La commande ${data.order.reference} est désormais « ${ORDER_STATUS_LABELS[data.order.status]} ». Le changement est journalisé.`,
      );
      recharger();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  if (acces !== 'ok') {
    return <EcranAcces etat={acces} sujet="gérer les commandes" onReessayer={recharger} />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <EnTete titre="Commandes" sousTitre="Suivi, détail et changement d’état encadré." />

      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setCriteres({ recherche: recherche.trim(), statut: filtreStatut });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Rechercher</span>
          <input
            className="h-11 w-60 rounded-md border border-border px-3"
            placeholder="Référence, ville ou client"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">État</span>
          <select
            className="h-11 w-56 rounded-md border border-border px-3"
            value={filtreStatut}
            onChange={(event) => setFiltreStatut(event.target.value as OrderStatus | '')}
          >
            <option value="">Tous les états</option>
            {ORDER_STATUSES.map((statut) => (
              <option key={statut} value={statut}>
                {ORDER_STATUS_LABELS[statut]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          <Search aria-hidden />
          Filtrer
        </Button>
      </form>

      {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
      {info ? <MessageInfo>{info}</MessageInfo> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section>
          {chargement ? (
            <SqueletteListe />
          ) : liste.length === 0 ? (
            <EtatVide
              titre="Aucune commande ne correspond"
              explication="Aucune commande n’a encore été enregistrée avec ces critères."
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{total} commande(s).</p>
              <ul className="mt-2 flex flex-col gap-2">
                {liste.map((commande) => (
                  <li key={commande.id}>
                    <button
                      type="button"
                      onClick={() => void ouvrirDetail(commande.id)}
                      aria-current={detail?.order.id === commande.id ? 'true' : undefined}
                      className="w-full rounded-md border border-border px-3 py-3 text-left hover:bg-surface-muted aria-[current=true]:border-imperial"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{commande.reference}</span>
                        <Badge tone={tonEtat(commande.status)}>{ORDER_STATUS_LABELS[commande.status]}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{commande.customerName || commande.customerEmail}</span>
                        <span>·</span>
                        <span>{commande.city || 'Ville non renseignée'}</span>
                        <span>·</span>
                        <span>{dateCourte(commande.createdAt)}</span>
                        {commande.kind === 'PREORDER' ? <Badge tone="gold">Précommande</Badge> : null}
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        <Money value={xaf(commande.totalXaf)} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section>
          {!detail ? (
            <Card className="text-center">
              <p className="text-sm font-semibold">Sélectionnez une commande</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Le détail, les paiements et les états possibles s’affichent ici.
              </p>
            </Card>
          ) : (
            <Card>
              <h2 className="text-base font-bold">{detail.order.reference}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {detail.order.customerName} — {detail.order.customerEmail}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {DELIVERY_MODE_LABELS[detail.order.deliveryMode].label} à {detail.order.city || '—'} ·{' '}
                {detail.phone || 'téléphone non renseigné'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Étape logistique : {SHIPMENT_STAGE_LABELS[detail.order.stage]}
              </p>

              <dl className="mt-3 flex flex-col gap-1 text-sm">
                {(
                  [
                    ['Sous-total', detail.amounts.subtotalXaf],
                    ['Transport', detail.amounts.freightXaf],
                    ['Service', detail.amounts.serviceFeeXaf],
                    ['Douane', detail.amounts.customsXaf],
                  ] as const
                ).map(([libelle, montant]) => (
                  <div key={libelle} className="flex justify-between">
                    <dt className="text-muted-foreground">{libelle}</dt>
                    <dd>
                      <Money value={xaf(montant)} />
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-1 font-semibold">
                  <dt>Total</dt>
                  <dd>
                    <Money value={xaf(detail.amounts.totalXaf)} />
                  </dd>
                </div>
              </dl>

              <h3 className="mt-4 text-sm font-bold">Lignes ({detail.lines.length})</h3>
              {detail.lines.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Aucune ligne enregistrée.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {detail.lines.map((ligne) => (
                    <li key={ligne.id} className="flex justify-between gap-2">
                      <span>
                        {ligne.label} × {ligne.quantity}
                      </span>
                      <Money value={xaf(ligne.lineTotalXaf)} />
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-4 text-sm font-bold">Paiements ({detail.payments.length})</h3>
              {detail.payments.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Aucun paiement rattaché à cette commande.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1 text-sm">
                  {detail.payments.map((paiement) => (
                    <li key={paiement.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {PAYMENT_METHOD_LABELS[paiement.method]} · {dateHeure(paiement.createdAt)}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge tone={paiement.status === 'SUCCEEDED' ? 'success' : 'neutral'}>
                          {PAYMENT_STATUS_LABELS[paiement.status]}
                        </Badge>
                        <Money value={xaf(paiement.amountXaf)} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-4 text-sm font-bold">Changer l’état</h3>
              {detail.allowedStatuses.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Une commande « {ORDER_STATUS_LABELS[detail.order.status]} » ne change plus d’état.
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold">Nouvel état</span>
                    <select
                      className="h-11 rounded-md border border-border px-3"
                      value={nouvelEtat}
                      onChange={(event) => setNouvelEtat(event.target.value as OrderStatus)}
                    >
                      {detail.allowedStatuses.map((statut) => (
                        <option key={statut} value={statut}>
                          {ORDER_STATUS_LABELS[statut]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold">Motif</span>
                    <input
                      className="h-11 rounded-md border border-border px-3"
                      placeholder="Pourquoi ce changement ?"
                      value={motif}
                      onChange={(event) => setMotif(event.target.value)}
                    />
                  </label>
                  <Button onClick={() => void changerEtat()} loading={enregistrement} disabled={enregistrement}>
                    Enregistrer le changement
                  </Button>
                </div>
              )}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
