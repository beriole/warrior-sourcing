'use client';

import {
  DISPUTE_CATEGORIES,
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_STATUSES,
  DISPUTE_STATUS_DESCRIPTIONS,
  DISPUTE_STATUS_LABELS,
  disputeStepIndex,
  type DisputeCategory,
  type DisputeDetailResponse,
  type DisputeListResponse,
  type DisputeResponse,
  type DisputeStatus,
} from '@ws/contracts';
import { Badge, Button, Card, Money, Progress } from '@ws/ui';
import { Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { appelApi, dateCourte, dateHeure, etatDepuisErreur, xaf, type EtatAcces } from '@/components/admin/api';
import { EcranAcces, EnTete, EtatVide, MessageErreur, MessageInfo, SqueletteListe } from '@/components/admin/etats';

const OUVERTURE_VIDE = {
  orderId: '',
  category: 'NON_CONFORME' as DisputeCategory,
  subject: '',
  description: '',
  claimedAmountXaf: 0,
};

function tonEtape(statut: DisputeStatus) {
  if (statut === 'CLOSED') return 'neutral' as const;
  if (statut === 'RESOLVED') return 'success' as const;
  if (statut === 'OPENED') return 'warning' as const;
  return 'brand' as const;
}

/**
 * Litiges (ADM-08, §39).
 *
 * Les sept étapes se franchissent une par une : l'écran ne propose que l'étape suivante,
 * renvoyée par le serveur, et une note est exigée à chaque passage. Le journal du dossier
 * conserve tout, y compris les preuves.
 */
export function LitigesView() {
  const [liste, setListe] = useState<DisputeResponse[]>([]);
  const [repartition, setRepartition] = useState<DisputeListResponse['byStatus']>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<DisputeDetailResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<EtatAcces>('ok');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<DisputeStatus | ''>('');
  const [criteres, setCriteres] = useState({ recherche: '', statut: '' as DisputeStatus | '' });
  const [version, setVersion] = useState(0);

  const [ouverture, setOuverture] = useState(OUVERTURE_VIDE);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [note, setNote] = useState('');
  const [preuve, setPreuve] = useState('');
  const [montantAccorde, setMontantAccorde] = useState('');
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
    appelApi<DisputeListResponse>(`/admin/disputes?${params.toString()}`)
      .then((data) => {
        setListe(data.disputes);
        setRepartition(data.byStatus);
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
      setNote('');
      setPreuve('');
      setMontantAccorde('');
      try {
        setDetail(await appelApi<DisputeDetailResponse>(`/admin/disputes/${id}`));
      } catch (e) {
        traiterErreur(e);
      }
    },
    [traiterErreur],
  );

  async function ouvrirLitige() {
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const data = await appelApi<DisputeDetailResponse>('/admin/disputes', {
        method: 'POST',
        body: JSON.stringify({
          orderId: ouverture.orderId.trim(),
          category: ouverture.category,
          subject: ouverture.subject.trim(),
          description: ouverture.description.trim(),
          claimedAmountXaf: Number(ouverture.claimedAmountXaf) || 0,
        }),
      });
      setDetail(data);
      setOuverture(OUVERTURE_VIDE);
      setFormulaireOuvert(false);
      setInfo(`Litige ${data.dispute.reference} ouvert sur la commande ${data.dispute.orderReference}.`);
      recharger();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  async function franchirEtape(cible: DisputeStatus) {
    if (!detail) return;
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const corps: Record<string, unknown> = { status: cible, note: note.trim() };
      if (preuve.trim()) corps.evidenceUrl = preuve.trim();
      if (montantAccorde.trim()) corps.resolvedAmountXaf = Number(montantAccorde);

      const data = await appelApi<DisputeDetailResponse>(`/admin/disputes/${detail.dispute.id}/etapes`, {
        method: 'POST',
        body: JSON.stringify(corps),
      });
      setDetail(data);
      setNote('');
      setPreuve('');
      setMontantAccorde('');
      setInfo(`Étape « ${DISPUTE_STATUS_LABELS[data.dispute.status]} » enregistrée et journalisée.`);
      recharger();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  if (acces !== 'ok') {
    return <EcranAcces etat={acces} sujet="traiter les litiges" onReessayer={recharger} />;
  }

  const etapeSuivante = detail?.allowedStatuses[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <EnTete
        titre="Litiges"
        sousTitre="Ouverture, analyse, preuves, fournisseur, proposition, résolution, clôture (§39)."
        actions={
          <Button variant="outline" onClick={() => setFormulaireOuvert((ouvert) => !ouvert)}>
            <Plus aria-hidden />
            Ouvrir un litige
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {repartition.map((etape) => (
          <Badge key={etape.status} tone={tonEtape(etape.status)}>
            {DISPUTE_STATUS_LABELS[etape.status]} : {etape.count}
          </Badge>
        ))}
      </div>

      {formulaireOuvert ? (
        <Card className="mt-4">
          <h2 className="text-base font-bold">Ouvrir un litige</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Le dossier démarre à l’étape « Ouverture ». Les étapes suivantes se franchissent une par une.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Identifiant de la commande</span>
              <input
                className="h-11 rounded-md border border-border px-3"
                value={ouverture.orderId}
                onChange={(event) => setOuverture({ ...ouverture, orderId: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Motif</span>
              <select
                className="h-11 rounded-md border border-border px-3"
                value={ouverture.category}
                onChange={(event) =>
                  setOuverture({ ...ouverture, category: event.target.value as DisputeCategory })
                }
              >
                {DISPUTE_CATEGORIES.map((categorie) => (
                  <option key={categorie} value={categorie}>
                    {DISPUTE_CATEGORY_LABELS[categorie]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Objet</span>
              <input
                className="h-11 rounded-md border border-border px-3"
                value={ouverture.subject}
                onChange={(event) => setOuverture({ ...ouverture, subject: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Montant contesté (FCFA)</span>
              <input
                type="number"
                min={0}
                className="h-11 rounded-md border border-border px-3"
                value={ouverture.claimedAmountXaf}
                onChange={(event) =>
                  setOuverture({ ...ouverture, claimedAmountXaf: Number(event.target.value) })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Faits</span>
              <textarea
                rows={3}
                className="rounded-md border border-border p-3"
                value={ouverture.description}
                onChange={(event) => setOuverture({ ...ouverture, description: event.target.value })}
              />
            </label>
          </div>
          <Button className="mt-3" onClick={() => void ouvrirLitige()} loading={enregistrement} disabled={enregistrement}>
            Ouvrir le dossier
          </Button>
        </Card>
      ) : null}

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
            placeholder="Référence ou objet"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Étape</span>
          <select
            className="h-11 w-56 rounded-md border border-border px-3"
            value={filtreStatut}
            onChange={(event) => setFiltreStatut(event.target.value as DisputeStatus | '')}
          >
            <option value="">Toutes les étapes</option>
            {DISPUTE_STATUSES.map((statut) => (
              <option key={statut} value={statut}>
                {DISPUTE_STATUS_LABELS[statut]}
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

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section>
          {chargement ? (
            <SqueletteListe />
          ) : liste.length === 0 ? (
            <EtatVide
              titre="Aucun litige"
              explication="Aucun dossier n’a été ouvert avec ces critères. C’est une bonne nouvelle."
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{total} dossier(s).</p>
              <ul className="mt-2 flex flex-col gap-2">
                {liste.map((litige) => (
                  <li key={litige.id}>
                    <button
                      type="button"
                      onClick={() => void ouvrirDetail(litige.id)}
                      aria-current={detail?.dispute.id === litige.id ? 'true' : undefined}
                      className="w-full rounded-md border border-border px-3 py-3 text-left hover:bg-surface-muted aria-[current=true]:border-imperial"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{litige.reference}</span>
                        <Badge tone={tonEtape(litige.status)}>{DISPUTE_STATUS_LABELS[litige.status]}</Badge>
                      </div>
                      <p className="mt-1 text-sm">{litige.subject}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Commande {litige.orderReference} · {litige.customerName || litige.customerEmail} ·{' '}
                        {dateCourte(litige.createdAt)}
                      </p>
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
              <p className="text-sm font-semibold">Sélectionnez un dossier</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Le journal complet et l’étape suivante possible s’affichent ici.
              </p>
            </Card>
          ) : (
            <Card>
              <h2 className="text-base font-bold">{detail.dispute.reference}</h2>
              <p className="mt-1 text-sm">{detail.dispute.subject}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {DISPUTE_CATEGORY_LABELS[detail.dispute.category]} · commande {detail.dispute.orderReference} ·{' '}
                {detail.dispute.customerName}
              </p>

              <div className="mt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{DISPUTE_STATUS_LABELS[detail.dispute.status]}</span>
                  <span className="text-muted-foreground">
                    étape {disputeStepIndex(detail.dispute.status) + 1} sur {DISPUTE_STATUSES.length}
                  </span>
                </div>
                <Progress
                  className="mt-1"
                  value={((disputeStepIndex(detail.dispute.status) + 1) / DISPUTE_STATUSES.length) * 100}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {DISPUTE_STATUS_DESCRIPTIONS[detail.dispute.status]}
                </p>
              </div>

              <dl className="mt-3 flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Montant contesté</dt>
                  <dd>
                    <Money value={xaf(detail.dispute.claimedAmountXaf)} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Montant accordé</dt>
                  <dd>
                    {detail.dispute.resolvedAmountXaf === null ? (
                      <span className="text-muted-foreground">non encore arrêté</span>
                    ) : (
                      <Money value={xaf(detail.dispute.resolvedAmountXaf)} />
                    )}
                  </dd>
                </div>
              </dl>

              <h3 className="mt-4 text-sm font-bold">Journal du dossier</h3>
              <ol className="mt-1 flex flex-col gap-2">
                {detail.events.map((evenement) => (
                  <li key={evenement.id} className="rounded-md border border-border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tonEtape(evenement.toStatus)}>
                        {DISPUTE_STATUS_LABELS[evenement.toStatus]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{dateHeure(evenement.createdAt)}</span>
                      {evenement.actorName ? (
                        <span className="text-xs font-semibold">{evenement.actorName}</span>
                      ) : null}
                    </div>
                    <p className="mt-1">{evenement.note}</p>
                    {evenement.evidenceUrl ? (
                      <a
                        href={evenement.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline"
                      >
                        Voir la preuve
                      </a>
                    ) : null}
                  </li>
                ))}
              </ol>

              <h3 className="mt-4 text-sm font-bold">Étape suivante</h3>
              {!etapeSuivante ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Ce dossier est clôturé : plus aucune action n’est possible.
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    Prochaine étape imposée : <strong>{DISPUTE_STATUS_LABELS[etapeSuivante]}</strong>.{' '}
                    {DISPUTE_STATUS_DESCRIPTIONS[etapeSuivante]}
                  </p>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold">Ce qui a été fait</span>
                    <textarea
                      rows={3}
                      className="rounded-md border border-border p-3"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold">Lien vers une preuve (facultatif)</span>
                    <input
                      className="h-11 rounded-md border border-border px-3"
                      placeholder="https://…"
                      value={preuve}
                      onChange={(event) => setPreuve(event.target.value)}
                    />
                  </label>
                  {etapeSuivante === 'RESOLVED' ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-semibold">Montant accordé (FCFA)</span>
                      <input
                        type="number"
                        min={0}
                        className="h-11 rounded-md border border-border px-3"
                        value={montantAccorde}
                        onChange={(event) => setMontantAccorde(event.target.value)}
                      />
                    </label>
                  ) : null}
                  <Button
                    onClick={() => void franchirEtape(etapeSuivante)}
                    loading={enregistrement}
                    disabled={enregistrement}
                  >
                    Passer à « {DISPUTE_STATUS_LABELS[etapeSuivante]} »
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
