'use client';

import {
  INSPECTION_RESULT_LABELS,
  INSPECTION_RESULTS,
  SHIPMENT_STAGE_LABELS,
  SHIPMENT_STAGES,
  SHIPPING_MODE_LABELS,
  SHIPPING_MODES,
  type BulkAdvanceRequest,
  type BulkAdvanceResponse,
  type CreateInspectionRequest,
  type InspectionResult,
  type OpsBoardResponse,
  type RecordShipmentEventRequest,
  type ShipmentStage,
  type ShippingMode,
  type TrackedOrderDetailResponse,
} from '@ws/contracts';
import { Badge, Button, Card, Money, Skeleton } from '@ws/ui';
import {
  CheckSquare,
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
  Search,
  Square,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { appelApi, ErreurApi } from '@/app/logistique/api';

type Colonne = OpsBoardResponse['columns'][number];
type CommandeTableau = Colonne['orders'][number];

const RESULT_TONES: Record<InspectionResult, 'success' | 'warning' | 'danger'> = {
  COMPLIANT: 'success',
  WITH_RESERVATIONS: 'warning',
  NON_COMPLIANT: 'danger',
};

function dateHeure(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Maintenant, au format attendu par un champ « datetime-local » (heure locale, sans secondes). */
function maintenantLocal() {
  const now = new Date();
  now.setSeconds(0, 0);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function xaf(amountMinor: number) {
  return { amountMinor, currency: 'XAF' as const };
}

/** Une adresse par ligne ; les lignes vides sont ignorées. */
function lignesEnUrls(texte: string): string[] {
  return texte
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0);
}

type FormulaireEvenement = {
  stage: ShipmentStage;
  occurredAt: string;
  description: string;
  proofUrl: string;
  proofUrls: string;
  rollbackReason: string;
};

type FormulaireInspection = {
  result: InspectionResult;
  quantityExpected: string;
  quantityReceived: string;
  defects: string;
  packaging: string;
  measurements: string;
  weightKg: string;
  photoUrls: string;
  videoUrl: string;
  notes: string;
};

const INSPECTION_VIDE: FormulaireInspection = {
  result: 'COMPLIANT',
  quantityExpected: '',
  quantityReceived: '',
  defects: '',
  packaging: '',
  measurements: '',
  weightKg: '',
  photoUrls: '',
  videoUrl: '',
  notes: '',
};

/**
 * Vue opérationnelle des agents (LOG-04) : une colonne par étape, filtres, sélection multiple
 * et avancement groupé. Le panneau latéral enregistre un événement ou une inspection (LOG-05)
 * sans quitter l'écran. Les fichiers sont référencés par URL : le dépôt est un autre lot.
 */
export function LogistiqueView() {
  const [recherche, setRecherche] = useState('');
  const [filtreMode, setFiltreMode] = useState<ShippingMode | ''>('');
  const [filtreEtape, setFiltreEtape] = useState<ShipmentStage | ''>('');
  const [livrees, setLivrees] = useState(false);
  const [criteres, setCriteres] = useState({
    recherche: '',
    mode: '' as ShippingMode | '',
    etape: '' as ShipmentStage | '',
    livrees: false,
  });
  const [version, setVersion] = useState(0);

  const [tableau, setTableau] = useState<OpsBoardResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<'ok' | 'non-connecte' | 'refuse'>('ok');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [descriptionGroupee, setDescriptionGroupee] = useState('');
  const [preuveGroupee, setPreuveGroupee] = useState('');
  const [avancement, setAvancement] = useState(false);

  const [referenceOuverte, setReferenceOuverte] = useState<string | null>(null);

  const traiterErreur = useCallback((e: unknown) => {
    if (e instanceof ErreurApi && e.statut === 401) setAcces('non-connecte');
    else if (e instanceof ErreurApi && e.statut === 403) setAcces('refuse');
    else setErreur(e instanceof Error ? e.message : 'Une erreur inattendue s’est produite.');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ livrees: criteres.livrees ? 'oui' : 'non' });
    if (criteres.recherche) params.set('recherche', criteres.recherche);
    if (criteres.mode) params.set('mode', criteres.mode);
    if (criteres.etape) params.set('stage', criteres.etape);

    appelApi<OpsBoardResponse>(`/logistics/board?${params.toString()}`)
      .then((data) => {
        setTableau(data);
        setAcces('ok');
        setErreur(null);
      })
      .catch(traiterErreur)
      .finally(() => setChargement(false));
  }, [criteres, version, traiterErreur]);

  // Le chargement se signale depuis les gestionnaires d'événements, jamais depuis l'effet lui-même.
  const recharger = useCallback(() => {
    setChargement(true);
    setVersion((v) => v + 1);
  }, []);

  const appliquerFiltres = (event: React.FormEvent) => {
    event.preventDefault();
    setChargement(true);
    setCriteres({ recherche: recherche.trim(), mode: filtreMode, etape: filtreEtape, livrees });
  };

  const colonnes = useMemo(
    () =>
      tableau
        ? tableau.columns.filter((colonne) => !criteres.etape || colonne.stage === criteres.etape)
        : [],
    [tableau, criteres.etape],
  );

  const basculer = (id: string) =>
    setSelection((actuelle) => {
      const suivante = new Set(actuelle);
      if (suivante.has(id)) suivante.delete(id);
      else suivante.add(id);
      return suivante;
    });

  const selectionnerColonne = (colonne: Colonne) =>
    setSelection((actuelle) => {
      const suivante = new Set(actuelle);
      const toutes = colonne.orders.every((commande) => suivante.has(commande.id));
      for (const commande of colonne.orders) {
        if (toutes) suivante.delete(commande.id);
        else suivante.add(commande.id);
      }
      return suivante;
    });

  const avancerSelection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selection.size === 0) return;
    setAvancement(true);
    setErreur(null);
    try {
      const corps: BulkAdvanceRequest = {
        orderIds: [...selection],
        description: descriptionGroupee.trim(),
        proofUrl: preuveGroupee.trim() || undefined,
      };
      const resultat = await appelApi<BulkAdvanceResponse>('/logistics/board/advance', {
        method: 'POST',
        body: JSON.stringify(corps),
      });
      const ignorees = resultat.skipped.length > 0 ? `, ${resultat.skipped.length} ignorée(s)` : '';
      setInfo(`${resultat.advanced.length} commande(s) passée(s) à l’étape suivante${ignorees}.`);
      setSelection(new Set());
      setDescriptionGroupee('');
      setPreuveGroupee('');
      recharger();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setAvancement(false);
    }
  };

  if (acces === 'non-connecte') {
    return (
      <Message
        titre="Connexion requise"
        texte="Connectez-vous avec un compte de l’équipe logistique pour accéder à cette vue."
      />
    );
  }
  if (acces === 'refuse') {
    return (
      <Message
        titre="Accès réservé"
        texte="Cette vue est réservée aux agents logistiques, aux agents Chine et aux administrateurs."
      />
    );
  }

  return (
    <div className="grid gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Logistique</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Une colonne par étape. Chaque enregistrement fait avancer la commande et prévient le
            client une fois.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={recharger}
          loading={chargement && tableau !== null}
        >
          <RefreshCw aria-hidden />
          Actualiser
        </Button>
      </header>

      <Card>
        <form
          onSubmit={appliquerFiltres}
          className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end"
        >
          <label className="relative grid gap-1 text-xs font-medium text-muted-foreground">
            Référence, code colis ou client
            <span className="relative block">
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={recherche}
                onChange={(event) => setRecherche(event.target.value)}
                placeholder="WS-… ou nom du client"
                className="h-10 w-full rounded-md border border-border bg-surface pr-3 pl-9 text-sm text-foreground outline-none focus-visible:border-primary"
              />
            </span>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Mode
            <select
              value={filtreMode}
              onChange={(event) => setFiltreMode(event.target.value as ShippingMode | '')}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground"
            >
              <option value="">Tous</option>
              {SHIPPING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {SHIPPING_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Étape
            <select
              value={filtreEtape}
              onChange={(event) => setFiltreEtape(event.target.value as ShipmentStage | '')}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground"
            >
              <option value="">Toutes</option>
              {SHIPMENT_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {SHIPMENT_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={livrees}
              onChange={(event) => setLivrees(event.target.checked)}
              className="size-4"
            />
            Inclure les livrées
          </label>
          <Button type="submit" size="sm">
            Filtrer
          </Button>
        </form>
      </Card>

      {erreur && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {erreur}
        </p>
      )}
      {info && (
        <p
          role="status"
          className="flex items-center justify-between gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-success"
        >
          {info}
          <button
            type="button"
            onClick={() => setInfo(null)}
            aria-label="Fermer"
            className="inline-flex size-8 items-center justify-center"
          >
            <X className="size-4" aria-hidden />
          </button>
        </p>
      )}

      {selection.size > 0 && (
        <Card className="border-gold bg-gold-soft/40">
          <form
            onSubmit={avancerSelection}
            className="grid gap-3 md:grid-cols-[auto_1fr_1fr_auto] md:items-end"
          >
            <p className="text-sm font-semibold">
              <span className="figures">{selection.size}</span> commande
              {selection.size > 1 ? 's' : ''} sélectionnée
              {selection.size > 1 ? 's' : ''}
            </p>
            <Champ
              label="Description de l’événement (même texte pour toutes)"
              value={descriptionGroupee}
              onChange={setDescriptionGroupee}
              requis
              placeholder="Lot chargé dans le conteneur MSKU-…"
            />
            <Champ
              label="Preuve (URL, facultatif)"
              value={preuveGroupee}
              onChange={setPreuveGroupee}
              type="url"
              placeholder="https://…"
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                loading={avancement}
                disabled={descriptionGroupee.trim().length < 3}
              >
                <ChevronRight aria-hidden />
                Passer à l’étape suivante
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelection(new Set())}
              >
                Vider
              </Button>
            </div>
          </form>
        </Card>
      )}

      {chargement && tableau === null ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-72 w-64 shrink-0 rounded-lg" />
          ))}
        </div>
      ) : tableau && tableau.total === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Aucune commande ne correspond à ces critères. Une commande apparaît ici dès qu’elle est
            payée.
          </p>
        </Card>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto pb-2"
          role="list"
          aria-label="Commandes par étape"
        >
          {colonnes.map((colonne) => (
            <section
              key={colonne.stage}
              role="listitem"
              aria-label={colonne.label}
              className="flex w-64 shrink-0 flex-col rounded-lg border border-border bg-surface-muted/60"
            >
              <header className="flex items-center justify-between gap-2 px-3 py-2">
                <h2 className="text-sm font-semibold">
                  {colonne.label}{' '}
                  <span className="figures text-xs font-normal text-muted-foreground">
                    ({colonne.orders.length})
                  </span>
                </h2>
                {colonne.orders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => selectionnerColonne(colonne)}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface"
                    aria-label={`Sélectionner toute la colonne ${colonne.label}`}
                  >
                    {colonne.orders.every((commande) => selection.has(commande.id)) ? (
                      <CheckSquare className="size-4" aria-hidden />
                    ) : (
                      <Square className="size-4" aria-hidden />
                    )}
                  </button>
                )}
              </header>
              <ul className="grid gap-2 px-2 pb-2">
                {colonne.orders.length === 0 && (
                  <li className="px-1 py-2 text-xs text-muted-foreground">Aucune commande.</li>
                )}
                {colonne.orders.map((commande) => (
                  <li key={commande.id}>
                    <CarteCommande
                      commande={commande}
                      selectionnee={selection.has(commande.id)}
                      onBasculer={() => basculer(commande.id)}
                      onOuvrir={() => setReferenceOuverte(commande.reference)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {referenceOuverte && (
        <PanneauCommande
          reference={referenceOuverte}
          onFermer={() => setReferenceOuverte(null)}
          onModifie={(message) => {
            setInfo(message);
            recharger();
          }}
          onErreur={traiterErreur}
        />
      )}
    </div>
  );
}

function CarteCommande({
  commande,
  selectionnee,
  onBasculer,
  onOuvrir,
}: {
  commande: CommandeTableau;
  selectionnee: boolean;
  onBasculer: () => void;
  onOuvrir: () => void;
}) {
  return (
    <div
      className={`rounded-md border bg-surface p-2 shadow-card ${selectionnee ? 'border-gold' : 'border-border'}`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selectionnee}
          onChange={onBasculer}
          aria-label={`Sélectionner la commande ${commande.reference}`}
          className="mt-1 size-4 shrink-0"
        />
        <button type="button" onClick={onOuvrir} className="min-w-0 flex-1 text-left">
          <span className="figures block truncate text-sm font-semibold">{commande.reference}</span>
          <span className="figures block text-xs text-muted-foreground">
            {commande.parcelCode ?? 'Code en attente'}
          </span>
          <span className="block truncate text-xs">{commande.customerName}</span>
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {commande.shippingMode && (
          <Badge tone="neutral">{SHIPPING_MODE_LABELS[commande.shippingMode]}</Badge>
        )}
        {commande.lastInspectionResult && (
          <Badge tone={RESULT_TONES[commande.lastInspectionResult]}>
            {INSPECTION_RESULT_LABELS[commande.lastInspectionResult]}
          </Badge>
        )}
        <span className="ml-auto text-xs">
          <Money value={xaf(commande.totalXaf)} />
        </span>
      </div>
      {commande.lastEvent && (
        <p
          className="mt-1 truncate text-xs text-muted-foreground"
          title={commande.lastEvent.description}
        >
          {dateHeure(commande.lastEvent.occurredAt)} · {commande.lastEvent.description}
        </p>
      )}
    </div>
  );
}

/** Panneau latéral : historique, saisie d'un événement (LOG-01) et d'une inspection (LOG-05). */
function PanneauCommande({
  reference,
  onFermer,
  onModifie,
  onErreur,
}: {
  reference: string;
  onFermer: () => void;
  onModifie: (message: string) => void;
  onErreur: (e: unknown) => void;
}) {
  const [detail, setDetail] = useState<TrackedOrderDetailResponse | null>(null);
  const [onglet, setOnglet] = useState<'evenement' | 'inspection'>('evenement');
  const [formEvenement, setFormEvenement] = useState<FormulaireEvenement | null>(null);
  const [formInspection, setFormInspection] = useState<FormulaireInspection>(INSPECTION_VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    appelApi<TrackedOrderDetailResponse>(`/logistics/orders/${encodeURIComponent(reference)}`)
      .then((data) => {
        setDetail(data);
        setFormEvenement((actuel) => ({
          stage: data.order.nextStage ?? data.order.stage,
          occurredAt: maintenantLocal(),
          description: actuel?.description ?? '',
          proofUrl: '',
          proofUrls: '',
          rollbackReason: '',
        }));
      })
      .catch(onErreur);
  }, [reference, version, onErreur]);

  const indexActuel = detail ? SHIPMENT_STAGES.indexOf(detail.order.stage) : 0;
  const retourEnArriere = formEvenement
    ? SHIPMENT_STAGES.indexOf(formEvenement.stage) < indexActuel
    : false;
  const inspectionPossible = detail ? indexActuel <= SHIPMENT_STAGES.indexOf('INSPECTION') : false;

  const enregistrerEvenement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formEvenement) return;
    setEnregistrement(true);
    setErreurLocale(null);
    try {
      const corps: RecordShipmentEventRequest = {
        stage: formEvenement.stage,
        occurredAt: new Date(formEvenement.occurredAt).toISOString(),
        description: formEvenement.description.trim(),
        proofUrl: formEvenement.proofUrl.trim() || undefined,
        proofUrls: lignesEnUrls(formEvenement.proofUrls),
        rollbackReason: retourEnArriere
          ? formEvenement.rollbackReason.trim() || undefined
          : undefined,
      };
      await appelApi(`/logistics/orders/${encodeURIComponent(reference)}/events`, {
        method: 'POST',
        body: JSON.stringify(corps),
      });
      onModifie(`Événement enregistré pour ${reference}.`);
      setVersion((v) => v + 1);
    } catch (e) {
      if (e instanceof ErreurApi && e.statut !== 401 && e.statut !== 403) {
        setErreurLocale([e.message, ...e.issues.map((issue) => issue.message)].join(' '));
      } else onErreur(e);
    } finally {
      setEnregistrement(false);
    }
  };

  const enregistrerInspection = async (event: React.FormEvent) => {
    event.preventDefault();
    setEnregistrement(true);
    setErreurLocale(null);
    try {
      const nombre = (valeur: string) => (valeur.trim() === '' ? undefined : Number(valeur));
      const poidsKg = nombre(formInspection.weightKg);
      const corps: CreateInspectionRequest = {
        result: formInspection.result,
        quantityExpected: nombre(formInspection.quantityExpected),
        quantityReceived: nombre(formInspection.quantityReceived),
        defects: formInspection.defects.trim() || undefined,
        packaging: formInspection.packaging.trim() || undefined,
        measurements: formInspection.measurements.trim() || undefined,
        // Le serveur stocke des grammes entiers : jamais de flottant en base.
        weightGrams: poidsKg === undefined ? undefined : Math.round(poidsKg * 1000),
        photoUrls: lignesEnUrls(formInspection.photoUrls),
        videoUrl: formInspection.videoUrl.trim() || undefined,
        notes: formInspection.notes.trim() || undefined,
      };
      await appelApi(`/logistics/orders/${encodeURIComponent(reference)}/inspections`, {
        method: 'POST',
        body: JSON.stringify(corps),
      });
      onModifie(`Rapport d’inspection enregistré et transmis au client pour ${reference}.`);
      setFormInspection(INSPECTION_VIDE);
      setOnglet('evenement');
      setVersion((v) => v + 1);
    } catch (e) {
      if (e instanceof ErreurApi && e.statut !== 401 && e.statut !== 403) {
        setErreurLocale([e.message, ...e.issues.map((issue) => issue.message)].join(' '));
      } else onErreur(e);
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-night/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Commande ${reference}`}
    >
      <button type="button" className="flex-1" aria-label="Fermer le panneau" onClick={onFermer} />
      <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-surface shadow-card">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="figures truncate font-display text-lg font-bold">{reference}</h2>
            {detail && (
              <p className="text-xs text-muted-foreground">
                <span className="figures">{detail.parcel?.code ?? 'Code en attente'}</span> ·{' '}
                {detail.order.stageLabel}
                {detail.order.nextStageLabel && <> → {detail.order.nextStageLabel}</>}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Fermer" onClick={onFermer}>
            <X aria-hidden />
          </Button>
        </header>

        {!detail || !formEvenement ? (
          <div className="grid gap-3 p-4">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-40 rounded-md" />
          </div>
        ) : (
          <div className="grid gap-4 p-4">
            <div className="flex gap-1 rounded-md bg-surface-muted p-1" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={onglet === 'evenement'}
                onClick={() => setOnglet('evenement')}
                className={`min-h-10 flex-1 rounded-md text-sm font-medium ${onglet === 'evenement' ? 'bg-surface shadow-card' : 'text-muted-foreground'}`}
              >
                Événement
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={onglet === 'inspection'}
                onClick={() => setOnglet('inspection')}
                disabled={!inspectionPossible}
                title={inspectionPossible ? undefined : 'La marchandise a déjà quitté l’entrepôt.'}
                className={`min-h-10 flex-1 rounded-md text-sm font-medium disabled:opacity-50 ${onglet === 'inspection' ? 'bg-surface shadow-card' : 'text-muted-foreground'}`}
              >
                Inspection
              </button>
            </div>

            {erreurLocale && (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {erreurLocale}
              </p>
            )}

            {onglet === 'evenement' ? (
              <form onSubmit={enregistrerEvenement} className="grid gap-3">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Étape atteinte
                  <select
                    value={formEvenement.stage}
                    onChange={(event) =>
                      setFormEvenement({
                        ...formEvenement,
                        stage: event.target.value as ShipmentStage,
                      })
                    }
                    className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground"
                  >
                    {SHIPMENT_STAGES.map((stage, index) => (
                      <option key={stage} value={stage}>
                        {index + 1}. {SHIPMENT_STAGE_LABELS[stage]}
                        {index === indexActuel
                          ? ' (actuelle)'
                          : index < indexActuel
                            ? ' (retour)'
                            : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <Champ
                  label="Date et heure réelles"
                  type="datetime-local"
                  value={formEvenement.occurredAt}
                  onChange={(occurredAt) => setFormEvenement({ ...formEvenement, occurredAt })}
                  requis
                />
                <ChampTexte
                  label="Description"
                  value={formEvenement.description}
                  onChange={(description) => setFormEvenement({ ...formEvenement, description })}
                  placeholder="Conteneur chargé à Guangzhou, départ prévu le…"
                  requis
                />
                <Champ
                  label="Preuve principale (URL, facultatif)"
                  type="url"
                  value={formEvenement.proofUrl}
                  onChange={(proofUrl) => setFormEvenement({ ...formEvenement, proofUrl })}
                  placeholder="https://…"
                />
                <ChampTexte
                  label="Autres preuves (une URL par ligne)"
                  value={formEvenement.proofUrls}
                  onChange={(proofUrls) => setFormEvenement({ ...formEvenement, proofUrls })}
                  lignes={2}
                />
                {retourEnArriere && (
                  <div className="grid gap-2 rounded-md bg-warning-soft p-3">
                    <p className="text-xs text-warning">
                      Retour en arrière : réservé aux administrateurs, avec un motif qui restera
                      visible du client.
                    </p>
                    <ChampTexte
                      label="Motif du retour en arrière"
                      value={formEvenement.rollbackReason}
                      onChange={(rollbackReason) =>
                        setFormEvenement({ ...formEvenement, rollbackReason })
                      }
                      requis
                    />
                  </div>
                )}
                <Button type="submit" loading={enregistrement}>
                  <ChevronRight aria-hidden />
                  Enregistrer l’événement
                </Button>
              </form>
            ) : (
              <form onSubmit={enregistrerInspection} className="grid gap-3">
                <fieldset className="grid gap-1">
                  <legend className="text-xs font-medium text-muted-foreground">Résultat</legend>
                  <div className="flex flex-wrap gap-2">
                    {INSPECTION_RESULTS.map((result) => (
                      <label
                        key={result}
                        className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${
                          formInspection.result === result
                            ? 'border-gold bg-gold-soft'
                            : 'border-border'
                        }`}
                      >
                        <input
                          type="radio"
                          name="result"
                          value={result}
                          checked={formInspection.result === result}
                          onChange={() => setFormInspection({ ...formInspection, result })}
                          className="size-4"
                        />
                        {INSPECTION_RESULT_LABELS[result]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid grid-cols-2 gap-3">
                  <Champ
                    label="Quantité attendue"
                    type="number"
                    value={formInspection.quantityExpected}
                    onChange={(v) => setFormInspection({ ...formInspection, quantityExpected: v })}
                  />
                  <Champ
                    label="Quantité reçue"
                    type="number"
                    value={formInspection.quantityReceived}
                    onChange={(v) => setFormInspection({ ...formInspection, quantityReceived: v })}
                  />
                </div>
                <ChampTexte
                  label="Défauts constatés"
                  value={formInspection.defects}
                  onChange={(v) => setFormInspection({ ...formInspection, defects: v })}
                  lignes={2}
                />
                <Champ
                  label="Emballage"
                  value={formInspection.packaging}
                  onChange={(v) => setFormInspection({ ...formInspection, packaging: v })}
                  placeholder="Cartons doubles, coins renforcés"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Champ
                    label="Mesures"
                    value={formInspection.measurements}
                    onChange={(v) => setFormInspection({ ...formInspection, measurements: v })}
                    placeholder="40 × 30 × 20 cm"
                  />
                  <Champ
                    label="Poids (kg)"
                    type="number"
                    value={formInspection.weightKg}
                    onChange={(v) => setFormInspection({ ...formInspection, weightKg: v })}
                  />
                </div>
                <ChampTexte
                  label="Photos (une URL par ligne)"
                  value={formInspection.photoUrls}
                  onChange={(v) => setFormInspection({ ...formInspection, photoUrls: v })}
                  lignes={3}
                />
                <Champ
                  label="Vidéo (URL, facultatif)"
                  type="url"
                  value={formInspection.videoUrl}
                  onChange={(v) => setFormInspection({ ...formInspection, videoUrl: v })}
                  placeholder="https://…"
                />
                <ChampTexte
                  label="Remarques pour le client"
                  value={formInspection.notes}
                  onChange={(v) => setFormInspection({ ...formInspection, notes: v })}
                  lignes={2}
                />
                <Button type="submit" loading={enregistrement}>
                  <ClipboardCheck aria-hidden />
                  Enregistrer et transmettre le rapport
                </Button>
              </form>
            )}

            <section aria-labelledby="historique-panneau" className="border-t border-border pt-4">
              <h3 id="historique-panneau" className="text-sm font-semibold">
                Historique{' '}
                <span className="figures text-xs font-normal text-muted-foreground">
                  ({detail.events.length})
                </span>
              </h3>
              {detail.inspections.length > 0 && (
                <ul className="mt-2 grid gap-1">
                  {detail.inspections.map((report) => (
                    <li key={report.id} className="flex items-center gap-2 text-xs">
                      <Badge tone={RESULT_TONES[report.result]}>{report.resultLabel}</Badge>
                      <span className="figures text-muted-foreground">
                        {dateHeure(report.inspectedAt)}
                      </span>
                      {report.inspectedByName && (
                        <span className="text-muted-foreground">· {report.inspectedByName}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {detail.events.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Aucun événement enregistré.</p>
              ) : (
                <ol className="mt-2 grid gap-2">
                  {detail.events.map((event) => (
                    <li key={event.id} className="rounded-md border border-border p-2 text-sm">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold">{event.stageLabel}</span>
                        <span className="figures text-xs text-muted-foreground">
                          {dateHeure(event.occurredAt)}
                        </span>
                        {event.rollbackReason && <Badge tone="warning">Retour</Badge>}
                        {event.recordedByName && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {event.recordedByName}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs">{event.description}</p>
                      {event.rollbackReason && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Motif : {event.rollbackReason}
                        </p>
                      )}
                      {(event.proofUrl || event.proofUrls.length > 0) && (
                        <p className="mt-1 text-xs">
                          {[event.proofUrl, ...event.proofUrls]
                            .filter((url): url is string => Boolean(url))
                            .map((url, index) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="mr-2 underline"
                              >
                                Preuve {index + 1}
                              </a>
                            ))}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function Message({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="p-4 md:p-6">
      <Card>
        <h1 className="font-display text-lg font-bold">{titre}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{texte}</p>
      </Card>
    </div>
  );
}

function Champ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  requis = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'url' | 'number' | 'datetime-local';
  placeholder?: string;
  requis?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        type={type}
        value={value}
        required={requis}
        placeholder={placeholder}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 'any' : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus-visible:border-primary"
      />
    </label>
  );
}

function ChampTexte({
  label,
  value,
  onChange,
  placeholder,
  requis = false,
  lignes = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  requis?: boolean;
  lignes?: number;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <textarea
        value={value}
        required={requis}
        placeholder={placeholder}
        rows={lignes}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
      />
    </label>
  );
}
