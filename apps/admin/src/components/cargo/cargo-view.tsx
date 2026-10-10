'use client';

import {
  FREIGHT_UNITS,
  SHIPPING_MODE_LABELS,
  SHIPPING_MODES,
  type CreateForwarderRequest,
  type CreateFreightRateRequest,
  type ForwarderDetailResponse,
  type ForwarderListResponse,
  type ForwarderResponse,
  type FreightRateResponse,
  type FreightUnit,
  type ShippingMode,
} from '@ws/contracts';
import { Badge, Button, Card, Money, Skeleton } from '@ws/ui';
import { Copy, Plus, Power, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { appelApi, ErreurApi } from '@/app/cargo/api';
import { Champ, ChampNombre } from '@/components/admin/champs';

const UNIT_LABELS: Record<FreightUnit, string> = { KG: 'au kilo', CBM: 'au m³' };

function dateCourte(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function xaf(amountMinor: number) {
  return { amountMinor, currency: 'XAF' as const };
}

/** Date du jour au format attendu par un champ « date ». */
function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

type FormulaireTransitaire = {
  name: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  cities: string;
  modes: ShippingMode[];
  notes: string;
  warehouseName: string;
  warehouseAddressZh: string;
  warehouseAddressLatin: string;
  warehouseContactName: string;
  warehousePhone: string;
  warehouseInstructions: string;
};

const TRANSITAIRE_VIDE: FormulaireTransitaire = {
  name: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  cities: '',
  modes: [],
  notes: '',
  warehouseName: '',
  warehouseAddressZh: '',
  warehouseAddressLatin: '',
  warehouseContactName: '',
  warehousePhone: '',
  warehouseInstructions: '',
};

type FormulaireGrille = {
  mode: ShippingMode;
  unit: FreightUnit;
  unitPriceXaf: number;
  minimumChargeXaf: number;
  weightBreakKg: number;
  transitDays: number;
  effectiveFrom: string;
  source: string;
};

const GRILLE_VIDE: FormulaireGrille = {
  mode: 'AIR',
  unit: 'KG',
  unitPriceXaf: 0,
  minimumChargeXaf: 0,
  weightBreakKg: 0,
  transitDays: 1,
  effectiveFrom: aujourdhui(),
  source: '',
};

/**
 * Transitaires et grilles tarifaires (CARGO-04).
 * Objectif : créer un transitaire et ses tarifs en moins de deux minutes, sans toucher au code.
 * Une grille ne se modifie jamais : on en crée une nouvelle, datée ; l'ancienne reste dans l'historique.
 */
export function CargoView() {
  const [recherche, setRecherche] = useState('');
  const [filtreMode, setFiltreMode] = useState<ShippingMode | ''>('');
  const [filtreActif, setFiltreActif] = useState<'oui' | 'non' | 'tous'>('tous');

  const [liste, setListe] = useState<ForwarderResponse[] | null>(null);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<'ok' | 'non-connecte' | 'refuse'>('ok');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ForwarderDetailResponse | null>(null);

  const [formTransitaire, setFormTransitaire] = useState<FormulaireTransitaire>(TRANSITAIRE_VIDE);
  const [modeFormulaire, setModeFormulaire] = useState<'creation' | 'edition'>('creation');
  const [formGrille, setFormGrille] = useState<FormulaireGrille>(GRILLE_VIDE);
  const [enregistrement, setEnregistrement] = useState(false);

  const traiterErreur = useCallback((e: unknown) => {
    if (e instanceof ErreurApi && e.statut === 401) setAcces('non-connecte');
    else if (e instanceof ErreurApi && e.statut === 403) setAcces('refuse');
    else setErreur(e instanceof Error ? e.message : 'Une erreur inattendue s’est produite.');
  }, []);

  /** Critères validés par le formulaire de recherche, et compteur de rechargement après une écriture. */
  const [criteres, setCriteres] = useState({ recherche: '', mode: '' as ShippingMode | '', actif: 'tous' as 'oui' | 'non' | 'tous' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams({ actif: criteres.actif });
    if (criteres.recherche) params.set('recherche', criteres.recherche);
    if (criteres.mode) params.set('mode', criteres.mode);

    appelApi<ForwarderListResponse>(`/cargo/forwarders?${params.toString()}`)
      .then((data) => {
        setListe(data.forwarders);
        setAcces('ok');
      })
      .catch(traiterErreur)
      .finally(() => setChargement(false));
  }, [criteres, version, traiterErreur]);

  const chargerListe = useCallback(async () => {
    setVersion((v) => v + 1);
  }, []);

  const chargerDetail = useCallback(
    async (id: string) => {
      try {
        const data = await appelApi<ForwarderDetailResponse>(`/cargo/forwarders/${id}`);
        setDetail(data);
        setModeFormulaire('edition');
        setFormTransitaire({
          name: data.forwarder.name,
          contactName: data.forwarder.contactName ?? '',
          contactPhone: data.forwarder.contactPhone ?? '',
          contactEmail: data.forwarder.contactEmail ?? '',
          cities: data.forwarder.cities.join(', '),
          modes: data.forwarder.modes,
          notes: data.forwarder.notes ?? '',
          warehouseName: data.forwarder.warehouseName ?? '',
          warehouseAddressZh: data.forwarder.warehouseAddressZh ?? '',
          warehouseAddressLatin: data.forwarder.warehouseAddressLatin ?? '',
          warehouseContactName: data.forwarder.warehouseContactName ?? '',
          warehousePhone: data.forwarder.warehousePhone ?? '',
          warehouseInstructions: data.forwarder.warehouseInstructions ?? '',
        });
      } catch (e) {
        traiterErreur(e);
      }
    },
    [traiterErreur],
  );

  function rechercher() {
    setChargement(true);
    setErreur(null);
    setCriteres({ recherche: recherche.trim(), mode: filtreMode, actif: filtreActif });
  }

  function selectionner(id: string) {
    setSelectionId(id);
    setInfo(null);
    void chargerDetail(id);
  }

  function commencerCreation() {
    setSelectionId(null);
    setDetail(null);
    setModeFormulaire('creation');
    setFormTransitaire(TRANSITAIRE_VIDE);
    setFormGrille(GRILLE_VIDE);
    setInfo(null);
  }

  function corpsTransitaire(): CreateForwarderRequest {
    return {
      name: formTransitaire.name.trim(),
      contactName: formTransitaire.contactName.trim() || undefined,
      contactPhone: formTransitaire.contactPhone.trim() || undefined,
      contactEmail: formTransitaire.contactEmail.trim() || undefined,
      cities: formTransitaire.cities
        .split(',')
        .map((ville) => ville.trim())
        .filter(Boolean),
      modes: formTransitaire.modes,
      notes: formTransitaire.notes.trim() || undefined,
      // Les champs d'entrepôt partent toujours, vides compris : c'est ce qui permet de
      // retirer une adresse. `undefined` laisserait l'ancienne valeur en place.
      warehouseName: formTransitaire.warehouseName.trim(),
      warehouseAddressZh: formTransitaire.warehouseAddressZh.trim(),
      warehouseAddressLatin: formTransitaire.warehouseAddressLatin.trim(),
      warehouseContactName: formTransitaire.warehouseContactName.trim(),
      warehousePhone: formTransitaire.warehousePhone.trim(),
      warehouseInstructions: formTransitaire.warehouseInstructions.trim(),
    };
  }

  async function enregistrerTransitaire() {
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      if (modeFormulaire === 'creation') {
        const cree = await appelApi<ForwarderResponse>('/cargo/forwarders', {
          method: 'POST',
          body: JSON.stringify(corpsTransitaire()),
        });
        setInfo(`${cree.name} créé. Ajoutez maintenant sa première grille tarifaire.`);
        setSelectionId(cree.id);
        await chargerDetail(cree.id);
      } else if (selectionId) {
        await appelApi<ForwarderResponse>(`/cargo/forwarders/${selectionId}`, {
          method: 'PATCH',
          body: JSON.stringify(corpsTransitaire()),
        });
        setInfo('Fiche mise à jour.');
        await chargerDetail(selectionId);
      }
      await chargerListe();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  async function basculerActivation(transitaire: ForwarderResponse) {
    setErreur(null);
    try {
      await appelApi<ForwarderResponse>(`/cargo/forwarders/${transitaire.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !transitaire.active }),
      });
      setInfo(transitaire.active ? `${transitaire.name} désactivé : il n’apparaît plus dans le calculateur.` : `${transitaire.name} réactivé.`);
      await chargerListe();
      if (selectionId === transitaire.id) await chargerDetail(transitaire.id);
    } catch (e) {
      traiterErreur(e);
    }
  }

  async function ajouterGrille() {
    if (!selectionId) return;
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const corps: CreateFreightRateRequest = {
        mode: formGrille.mode,
        unit: formGrille.unit,
        unitPriceXaf: Math.round(formGrille.unitPriceXaf),
        minimumChargeXaf: Math.round(formGrille.minimumChargeXaf),
        weightBreakKg: Math.round(formGrille.weightBreakKg),
        transitDays: Math.round(formGrille.transitDays),
        effectiveFrom: formGrille.effectiveFrom,
        source: formGrille.source.trim(),
      };
      await appelApi<FreightRateResponse>(`/cargo/forwarders/${selectionId}/rates`, {
        method: 'POST',
        body: JSON.stringify(corps),
      });
      setInfo('Grille ajoutée. La précédente reste dans l’historique avec sa date.');
      setFormGrille({ ...GRILLE_VIDE, mode: formGrille.mode, unit: formGrille.unit });
      await chargerDetail(selectionId);
      await chargerListe();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  /** Duplication : le formulaire reprend la grille, l'administrateur ajuste le prix et la date. */
  function dupliquerGrille(rate: FreightRateResponse) {
    setFormGrille({
      mode: rate.mode,
      unit: rate.unit,
      unitPriceXaf: rate.unitPriceXaf,
      minimumChargeXaf: rate.minimumChargeXaf,
      weightBreakKg: rate.weightBreakKg,
      transitDays: rate.transitDays,
      effectiveFrom: aujourdhui(),
      source: rate.source,
    });
    setInfo('Grille copiée dans le formulaire : ajustez le prix et la date, puis enregistrez.');
    document.getElementById('formulaire-grille')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function basculerGrille(rate: FreightRateResponse) {
    if (!selectionId) return;
    setErreur(null);
    try {
      await appelApi<FreightRateResponse>(`/cargo/rates/${rate.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !rate.active }),
      });
      await chargerDetail(selectionId);
    } catch (e) {
      traiterErreur(e);
    }
  }

  if (acces !== 'ok') {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <h1 className="text-lg font-bold">
          {acces === 'non-connecte' ? 'Connexion requise' : 'Accès réservé à l’administration'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {acces === 'non-connecte'
            ? 'Connectez-vous sur le site avec un compte administrateur, puis revenez sur cette page.'
            : 'Votre compte n’a pas les droits pour gérer les transitaires. Demandez à un administrateur.'}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => void chargerListe()}>
          <RefreshCw aria-hidden />
          Réessayer
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transitaires et tarifs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Les grilles saisies ici alimentent le calculateur. Un tarif ne s’écrase jamais : une
            nouvelle grille date la précédente.
          </p>
        </div>
        <Button onClick={commencerCreation}>
          <Plus aria-hidden />
          Nouveau transitaire
        </Button>
      </div>

      {erreur && (
        <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {erreur}
        </p>
      )}
      {info && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          {info}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="grid min-w-0 content-start gap-4">
          <Card>
            <form
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                rechercher();
              }}
            >
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Rechercher
                <input
                  value={recherche}
                  onChange={(event) => setRecherche(event.target.value)}
                  placeholder="Nom, contact ou ville"
                  className="h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus-visible:border-primary"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Mode
                <select
                  value={filtreMode}
                  onChange={(event) => setFiltreMode(event.target.value as ShippingMode | '')}
                  className="h-10 w-full min-w-0 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
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
                État
                <select
                  value={filtreActif}
                  onChange={(event) => setFiltreActif(event.target.value as 'oui' | 'non' | 'tous')}
                  className="h-10 w-full min-w-0 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
                >
                  <option value="tous">Tous</option>
                  <option value="oui">Actifs</option>
                  <option value="non">Désactivés</option>
                </select>
              </label>
              <Button type="submit" variant="outline" size="sm" className="self-end h-10" aria-label="Lancer la recherche">
                <Search aria-hidden />
              </Button>
            </form>
          </Card>

          <Card className="p-0">
            {chargement && liste === null ? (
              <div className="grid gap-2 p-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : liste && liste.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Aucun transitaire ne correspond. Créez le premier : le calculateur utilisera ses tarifs
                à la place des fourchettes d’estimation.
              </p>
            ) : (
              <table className="w-full min-w-0 text-sm">
                <thead className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-2 font-medium">Transitaire</th>
                    <th className="px-2 py-2 font-medium">Modes</th>
                    <th className="px-2 py-2 font-medium">Grilles</th>
                    <th className="px-2 py-2 font-medium">État</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(liste ?? []).map((transitaire) => (
                    <tr
                      key={transitaire.id}
                      className={`border-b border-border last:border-0 ${
                        selectionId === transitaire.id ? 'bg-imperial-soft' : 'hover:bg-surface-muted'
                      }`}
                    >
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          className="text-left font-semibold underline-offset-4 hover:underline"
                          onClick={() => selectionner(transitaire.id)}
                        >
                          {transitaire.name}
                        </button>
                        <span className="block text-xs text-muted-foreground">
                          {transitaire.cities.join(', ') || 'Villes non renseignées'}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {transitaire.modes.map((mode) => SHIPPING_MODE_LABELS[mode]).join(', ')}
                      </td>
                      <td className="figures px-2 py-2">{transitaire.rateCount}</td>
                      <td className="px-2 py-2">
                        <Badge tone={transitaire.active ? 'success' : 'neutral'}>
                          {transitaire.active ? 'Actif' : 'Désactivé'}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void basculerActivation(transitaire)}
                        >
                          <Power aria-hidden />
                          {transitaire.active ? 'Désactiver' : 'Réactiver'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <Card>
            <h2 className="text-base font-semibold">
              {modeFormulaire === 'creation' ? 'Nouveau transitaire' : `Fiche : ${detail?.forwarder.name ?? ''}`}
            </h2>
            <form
              className="mt-3 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void enregistrerTransitaire();
              }}
            >
              <Champ label="Nom" value={formTransitaire.name} onChange={(v) => setFormTransitaire({ ...formTransitaire, name: v })} requis />
              <div className="grid gap-3 sm:grid-cols-3">
                <Champ label="Contact" value={formTransitaire.contactName} onChange={(v) => setFormTransitaire({ ...formTransitaire, contactName: v })} />
                <Champ label="Téléphone" value={formTransitaire.contactPhone} onChange={(v) => setFormTransitaire({ ...formTransitaire, contactPhone: v })} />
                <Champ label="Email" type="email" value={formTransitaire.contactEmail} onChange={(v) => setFormTransitaire({ ...formTransitaire, contactEmail: v })} />
              </div>
              <Champ
                label="Villes desservies (séparées par des virgules)"
                value={formTransitaire.cities}
                onChange={(v) => setFormTransitaire({ ...formTransitaire, cities: v })}
                placeholder="Douala, Yaoundé"
              />
              <fieldset className="grid gap-1">
                <legend className="text-xs font-medium text-muted-foreground">Modes servis</legend>
                <div className="flex flex-wrap gap-2">
                  {SHIPPING_MODES.map((mode) => {
                    const coche = formTransitaire.modes.includes(mode);
                    return (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={coche}
                        onClick={() =>
                          setFormTransitaire({
                            ...formTransitaire,
                            modes: coche
                              ? formTransitaire.modes.filter((m) => m !== mode)
                              : [...formTransitaire.modes, mode],
                          })
                        }
                        className={`min-h-10 rounded-full border px-4 text-sm font-medium ${
                          coche ? 'border-primary bg-primary text-white' : 'border-border bg-surface hover:bg-surface-muted'
                        }`}
                      >
                        {SHIPPING_MODE_LABELS[mode]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Notes internes
                <textarea
                  value={formTransitaire.notes}
                  onChange={(event) => setFormTransitaire({ ...formTransitaire, notes: event.target.value })}
                  rows={2}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
                />
              </label>
              {/*
                L'entrepôt chinois. C'est la seule source de l'adresse que l'assistant fait
                copier aux importateurs : rien n'est engendré ailleurs. Tant que l'adresse
                en caractères chinois est vide, ce transitaire n'est pas proposé — mieux
                vaut aucune adresse qu'une adresse à trous.
              */}
              <fieldset className="grid gap-3 rounded-md border border-border p-3">
                <legend className="px-1 text-xs font-semibold text-foreground">
                  Entrepôt de groupage en Chine
                </legend>
                <p className="text-xs text-muted-foreground">
                  C’est l’adresse que l’importateur donnera à son fournisseur. Elle apparaît telle
                  quelle dans l’assistant d’adresse, avec le code client du compte.
                </p>

                <Champ
                  label="Nom de l’entrepôt"
                  value={formTransitaire.warehouseName}
                  onChange={(v) => setFormTransitaire({ ...formTransitaire, warehouseName: v })}
                  placeholder="Entrepôt Guangzhou"
                />

                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Adresse en caractères chinois
                  <textarea
                    value={formTransitaire.warehouseAddressZh}
                    onChange={(event) =>
                      setFormTransitaire({ ...formTransitaire, warehouseAddressZh: event.target.value })
                    }
                    rows={2}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
                  />
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Obligatoire pour que l’assistant propose cet entrepôt : c’est cette version que
                    le transporteur local lit. Copiez-la depuis le transitaire, ne la retapez pas.
                  </span>
                </label>

                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Adresse en lettres latines
                  <textarea
                    value={formTransitaire.warehouseAddressLatin}
                    onChange={(event) =>
                      setFormTransitaire({ ...formTransitaire, warehouseAddressLatin: event.target.value })
                    }
                    rows={2}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
                  />
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Sert à relire la saisie. Elle ne remplace jamais la version chinoise.
                  </span>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Champ
                    label="Destinataire sur place"
                    value={formTransitaire.warehouseContactName}
                    onChange={(v) => setFormTransitaire({ ...formTransitaire, warehouseContactName: v })}
                    aide="Le code client du compte sera ajouté après ce nom."
                  />
                  <Champ
                    label="Téléphone chinois"
                    value={formTransitaire.warehousePhone}
                    onChange={(v) => setFormTransitaire({ ...formTransitaire, warehousePhone: v })}
                    placeholder="+86 ..."
                    aide="Le transporteur local appelle ce numéro, pas celui du client."
                  />
                </div>

                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Consignes de cet entrepôt
                  <textarea
                    value={formTransitaire.warehouseInstructions}
                    onChange={(event) =>
                      setFormTransitaire({ ...formTransitaire, warehouseInstructions: event.target.value })
                    }
                    rows={2}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
                  />
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Marquage des cartons, horaires de réception, pièces à joindre. Affiché sous le bloc
                    d’adresse.
                  </span>
                </label>
              </fieldset>

              <div className="flex items-center gap-2">
                <Button type="submit" loading={enregistrement} disabled={formTransitaire.name.trim().length < 2 || formTransitaire.modes.length === 0}>
                  {modeFormulaire === 'creation' ? 'Créer le transitaire' : 'Enregistrer la fiche'}
                </Button>
                {detail && (
                  <Badge tone={detail.forwarder.active ? 'success' : 'neutral'}>
                    {detail.forwarder.active ? 'Actif' : 'Désactivé'}
                  </Badge>
                )}
              </div>
            </form>
          </Card>

          {detail && (
            <>
              <Card id="formulaire-grille">
                <h2 className="text-base font-semibold">Nouvelle grille tarifaire</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Montants en FCFA entiers. La grille s’applique à partir de sa date d’entrée en vigueur,
                  pour les envois dont le poids facturable atteint le palier.
                </p>
                <form
                  className="mt-3 grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void ajouterGrille();
                  }}
                >
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    Mode
                    <select
                      value={formGrille.mode}
                      onChange={(event) => setFormGrille({ ...formGrille, mode: event.target.value as ShippingMode })}
                      className="h-10 w-full min-w-0 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
                    >
                      {SHIPPING_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {SHIPPING_MODE_LABELS[mode]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    Unité de facturation
                    <select
                      value={formGrille.unit}
                      onChange={(event) => setFormGrille({ ...formGrille, unit: event.target.value as FreightUnit })}
                      className="h-10 w-full min-w-0 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
                    >
                      {FREIGHT_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {UNIT_LABELS[unit]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ChampNombre label="Prix unitaire (FCFA)" value={formGrille.unitPriceXaf} onChange={(v) => setFormGrille({ ...formGrille, unitPriceXaf: v })} min={1} />
                  <ChampNombre label="Minimum facturé (FCFA)" value={formGrille.minimumChargeXaf} onChange={(v) => setFormGrille({ ...formGrille, minimumChargeXaf: v })} />
                  <ChampNombre label="Palier : à partir de (kg)" value={formGrille.weightBreakKg} onChange={(v) => setFormGrille({ ...formGrille, weightBreakKg: v })} />
                  <ChampNombre label="Délai annoncé (jours)" value={formGrille.transitDays} onChange={(v) => setFormGrille({ ...formGrille, transitDays: v })} min={1} />
                  <Champ label="Entrée en vigueur" type="date" value={formGrille.effectiveFrom} onChange={(v) => setFormGrille({ ...formGrille, effectiveFrom: v })} requis />
                  <Champ label="Source (devis, email, appel…)" value={formGrille.source} onChange={(v) => setFormGrille({ ...formGrille, source: v })} placeholder="Devis reçu le 15/09/2026" requis />
                  <div className="sm:col-span-2">
                    <Button
                      type="submit"
                      loading={enregistrement}
                      disabled={formGrille.unitPriceXaf < 1 || formGrille.transitDays < 1 || formGrille.source.trim().length < 2 || !formGrille.effectiveFrom}
                    >
                      <Plus aria-hidden />
                      Ajouter cette grille
                    </Button>
                  </div>
                </form>
              </Card>

              <Card className="p-0">
                <div className="flex items-center justify-between px-4 py-3">
                  <h2 className="text-base font-semibold">Historique des tarifs</h2>
                  <span className="text-xs text-muted-foreground">{detail.rates.length} grille{detail.rates.length > 1 ? 's' : ''}</span>
                </div>
                {detail.rates.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">
                    Aucune grille : le calculateur applique une fourchette d’estimation pour ce transitaire.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-0 text-sm">
                      <thead className="border-t border-b border-border text-left text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-4 py-2 font-medium">Mode</th>
                          <th className="px-2 py-2 font-medium">Prix</th>
                          <th className="px-2 py-2 font-medium">Minimum</th>
                          <th className="px-2 py-2 font-medium">Palier</th>
                          <th className="px-2 py-2 font-medium">Délai</th>
                          <th className="px-2 py-2 font-medium">En vigueur</th>
                          <th className="px-2 py-2 font-medium">Source</th>
                          <th className="px-2 py-2 font-medium">État</th>
                          <th className="px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {detail.rates.map((rate) => (
                          <tr key={rate.id} className={`border-b border-border last:border-0 ${rate.active ? '' : 'text-muted-foreground'}`}>
                            <td className="px-4 py-2 font-medium">{SHIPPING_MODE_LABELS[rate.mode]}</td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              <Money value={xaf(rate.unitPriceXaf)} /> {UNIT_LABELS[rate.unit]}
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              {rate.minimumChargeXaf > 0 ? <Money value={xaf(rate.minimumChargeXaf)} /> : '—'}
                            </td>
                            <td className="figures px-2 py-2">{rate.weightBreakKg > 0 ? `≥ ${rate.weightBreakKg} kg` : 'dès 0 kg'}</td>
                            <td className="figures px-2 py-2">{rate.transitDays} j</td>
                            <td className="figures px-2 py-2 whitespace-nowrap">{dateCourte(rate.effectiveFrom)}</td>
                            <td className="max-w-40 truncate px-2 py-2 text-xs" title={rate.source}>{rate.source}</td>
                            <td className="px-2 py-2">
                              <Badge tone={rate.active ? 'success' : 'neutral'}>{rate.active ? 'En service' : 'Hors service'}</Badge>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap text-right">
                              <Button type="button" variant="ghost" size="sm" aria-label="Dupliquer cette grille" onClick={() => dupliquerGrille(rate)}>
                                <Copy aria-hidden />
                                Dupliquer
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => void basculerGrille(rate)}>
                                <Power aria-hidden />
                                {rate.active ? 'Retirer' : 'Remettre'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
