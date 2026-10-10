'use client';

import {
  INTEREST_CATEGORIES,
  INTEREST_CATEGORY_LABELS,
  MARKET_LEVELS,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  RISK_LEVELS,
  RISK_LEVEL_LABELS,
  TRANSPORT_EASES,
  TRANSPORT_EASE_LABELS,
  type AdminProductDetailResponse,
  type AdminProductListResponse,
  type AdminProductResponse,
  type InterestCategory,
  type MarketLevel,
  type ProductStatus,
  type RiskLevel,
  type TransportEase,
} from '@ws/contracts';
import { Badge, Button, Card, Money } from '@ws/ui';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { appelApi, dateCourte, etatDepuisErreur, xaf, type EtatAcces } from '@/components/admin/api';
import { Champ, ChampChoix, ChampNombre, ChampTexte, Section } from '@/components/admin/champs';
import {
  EcranAcces,
  EnTete,
  EtatVide,
  MessageErreur,
  MessageInfo,
  SqueletteListe,
} from '@/components/admin/etats';

const TON_STATUT: Record<ProductStatus, 'success' | 'warning' | 'neutral'> = {
  PUBLISHED: 'success',
  DRAFT: 'warning',
  ARCHIVED: 'neutral',
};

const MARKET_LABELS: Record<MarketLevel, string> = { LOW: 'Faible', MEDIUM: 'Moyenne', HIGH: 'Forte' };

/**
 * Le compte par état se lit dans une phrase : « 10 fiches — 8 publiées, 2 brouillons ».
 * Le libellé seul du statut ne s'accorde pas, et « 10 publié » se remarque tout de suite.
 */
const COMPTE_PAR_STATUT: Record<ProductStatus, (nombre: number) => string> = {
  DRAFT: (n) => `${n} brouillon${n > 1 ? 's' : ''}`,
  PUBLISHED: (n) => `${n} publiée${n > 1 ? 's' : ''}`,
  ARCHIVED: (n) => `${n} retirée${n > 1 ? 's' : ''}`,
};

/** Date du jour au format d'un champ `date`, pour pré-remplir un relevé. */
function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Un champ `date` ne transporte pas d'heure : on complète pour obtenir un instant ISO. */
function enInstant(jour: string): string {
  return new Date(`${jour}T12:00:00.000Z`).toISOString();
}

const FORM_VIDE = {
  name: '',
  description: '',
  category: 'ELECTRONICS' as InterestCategory,
  purchasePriceMinor: 0,
  exchangeRate: 85,
  exchangeRateAt: aujourdhui(),
  exchangeRateSource: '',
  moq: 0,
  weightGrams: 0,
  volumeCm3: 0,
  watchPoints: '',
};

const MARCHE_VIDE = {
  localPriceMinXaf: 0,
  localPriceMaxXaf: 0,
  localPriceObservedAt: '',
  localPriceSource: '',
  demand: '' as MarketLevel | '',
  competition: '' as MarketLevel | '',
  risk: '' as RiskLevel | '',
  transportEase: '' as TransportEase | '',
  capitalRequiredXaf: 0,
  assessedAt: '',
  assessmentSource: '',
};

/**
 * Gestion des fiches produits (ADM-03, §12, §13).
 *
 * L'écran suit la règle du serveur plutôt que de la redire : la liste de ce qui manque
 * pour publier vient de l'API (`missingForPublication`), et le bouton « Publier » reste
 * désactivé tant qu'elle n'est pas vide. Une seule définition de « fiche publiable »,
 * et c'est celle qui décide réellement.
 */
export function ProduitsView() {
  const [liste, setListe] = useState<AdminProductResponse[]>([]);
  const [parStatut, setParStatut] = useState<AdminProductListResponse['byStatus']>([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<EtatAcces>('ok');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<ProductStatus | ''>('');
  const [criteres, setCriteres] = useState({ recherche: '', statut: '' as ProductStatus | '' });
  const [version, setVersion] = useState(0);

  const [detail, setDetail] = useState<AdminProductDetailResponse | null>(null);
  const [creation, setCreation] = useState(false);
  const [form, setForm] = useState(FORM_VIDE);
  const [marche, setMarche] = useState(MARCHE_VIDE);
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
    if (criteres.statut) params.set('status', criteres.statut);
    appelApi<AdminProductListResponse>(`/admin/products?${params.toString()}`)
      .then((data) => {
        setListe(data.items);
        setParStatut(data.byStatus);
        setTotal(data.total);
        setAcces('ok');
      })
      .catch(traiterErreur)
      .finally(() => setChargement(false));
  }, [criteres, version, traiterErreur]);

  function rafraichir() {
    setChargement(true);
    setVersion((v) => v + 1);
  }

  async function ouvrir(id: string) {
    setErreur(null);
    setInfo(null);
    setCreation(false);
    try {
      const data = await appelApi<AdminProductDetailResponse>(`/admin/products/${id}`);
      setDetail(data);
      setMarche({
        localPriceMinXaf: data.market?.localPriceMinXaf ?? 0,
        localPriceMaxXaf: data.market?.localPriceMaxXaf ?? 0,
        localPriceObservedAt: data.market?.localPriceObservedAt?.slice(0, 10) ?? '',
        localPriceSource: data.market?.localPriceSource ?? '',
        demand: data.market?.demand ?? '',
        competition: data.market?.competition ?? '',
        risk: data.market?.risk ?? '',
        transportEase: data.market?.transportEase ?? '',
        capitalRequiredXaf: data.market?.capitalRequiredXaf ?? 0,
        assessedAt: data.market?.assessedAt?.slice(0, 10) ?? '',
        assessmentSource: data.market?.assessmentSource ?? '',
      });
      setMotif('');
    } catch (e) {
      traiterErreur(e);
    }
  }

  async function creer() {
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const data = await appelApi<AdminProductDetailResponse>('/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          category: form.category,
          purchasePriceMinor: form.purchasePriceMinor,
          purchaseCurrency: 'CNY',
          exchangeRate: form.exchangeRate,
          exchangeRateAt: enInstant(form.exchangeRateAt),
          exchangeRateSource: form.exchangeRateSource,
          moq: form.moq,
          weightGrams: form.weightGrams,
          volumeCm3: form.volumeCm3 > 0 ? form.volumeCm3 : null,
          watchPoints: form.watchPoints
            .split('\n')
            .map((ligne) => ligne.trim())
            .filter(Boolean),
        }),
      });
      setCreation(false);
      setForm(FORM_VIDE);
      setDetail(data);
      setInfo('Fiche créée en brouillon. Complétez-la, puis publiez-la.');
      rafraichir();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  async function changerStatut(statut: ProductStatus) {
    if (!detail) return;
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const data = await appelApi<AdminProductDetailResponse>(
        `/admin/products/${detail.product.id}/status`,
        { method: 'PATCH', body: JSON.stringify({ status: statut, reason: motif }) },
      );
      setDetail(data);
      setMotif('');
      setInfo(
        statut === 'PUBLISHED'
          ? 'Fiche publiée. Elle apparaît au catalogue public.'
          : 'Fiche retirée du catalogue public. Son historique est conservé.',
      );
      rafraichir();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  async function enregistrerMarche() {
    if (!detail) return;
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const data = await appelApi<AdminProductDetailResponse>(
        `/admin/products/${detail.product.id}/market`,
        {
          method: 'PUT',
          body: JSON.stringify({
            localPriceMinXaf: marche.localPriceMinXaf > 0 ? marche.localPriceMinXaf : null,
            localPriceMaxXaf: marche.localPriceMaxXaf > 0 ? marche.localPriceMaxXaf : null,
            localPriceObservedAt: marche.localPriceObservedAt
              ? enInstant(marche.localPriceObservedAt)
              : null,
            localPriceSource: marche.localPriceSource || null,
            demand: marche.demand || null,
            competition: marche.competition || null,
            risk: marche.risk || null,
            transportEase: marche.transportEase || null,
            capitalRequiredXaf: marche.capitalRequiredXaf > 0 ? marche.capitalRequiredXaf : null,
            assessedAt: marche.assessedAt ? enInstant(marche.assessedAt) : null,
            assessmentSource: marche.assessmentSource || null,
          }),
        },
      );
      setDetail(data);
      setInfo('Relevé de marché enregistré.');
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  if (acces !== 'ok') {
    return <EcranAcces etat={acces} sujet="gérer le catalogue" onReessayer={rafraichir} />;
  }

  const manques = detail?.product.missingForPublication ?? [];

  return (
    <div className="grid gap-5">
      <EnTete
        titre="Produits"
        sousTitre="Une fiche se crée en brouillon, se complète, puis se publie. Le serveur refuse de publier une fiche incomplète."
        actions={
          <Button
            onClick={() => {
              setCreation(true);
              setDetail(null);
              setForm(FORM_VIDE);
            }}
          >
            <Plus aria-hidden />
            Nouvelle fiche
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid flex-1 gap-1 text-xs font-medium text-muted-foreground sm:max-w-sm">
          Rechercher
          <input
            value={recherche}
            placeholder="Nom du produit"
            onChange={(event) => setRecherche(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setCriteres({ recherche, statut: filtreStatut });
            }}
            className="h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
          />
        </label>
        <ChampChoix
          label="État"
          value={filtreStatut}
          onChange={setFiltreStatut}
          vide="Tous"
          options={PRODUCT_STATUSES.map((statut) => ({
            value: statut,
            label: PRODUCT_STATUS_LABELS[statut].label,
          }))}
        />
        <Button variant="outline" onClick={() => setCriteres({ recherche, statut: filtreStatut })}>
          <Search aria-hidden />
          Filtrer
        </Button>
      </div>

      <p className="figures text-xs text-muted-foreground">
        {total} fiche{total > 1 ? 's' : ''}
        {parStatut.length > 0 && (
          <>
            {' — '}
            {parStatut.map((item) => COMPTE_PAR_STATUT[item.status](item.count)).join(', ')}
          </>
        )}
      </p>

      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {info && <MessageInfo>{info}</MessageInfo>}

      {chargement ? (
        <SqueletteListe />
      ) : liste.length === 0 ? (
        <EtatVide
          titre="Aucune fiche ne correspond"
          explication="Modifiez la recherche, ou créez une nouvelle fiche produit."
        />
      ) : (
        <ul className="grid gap-2">
          {liste.map((produit) => (
            <li key={produit.id}>
              <button
                type="button"
                onClick={() => void ouvrir(produit.id)}
                aria-current={detail?.product.id === produit.id ? 'true' : undefined}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  detail?.product.id === produit.id
                    ? 'border-primary bg-surface-muted'
                    : 'border-border bg-surface hover:bg-surface-muted'
                }`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{produit.name}</span>
                  <Badge tone={TON_STATUT[produit.status]}>{produit.statusLabel}</Badge>
                  <Badge tone="neutral">{produit.categoryLabel}</Badge>
                  {produit.missingForPublication.length > 0 && produit.status !== 'PUBLISHED' && (
                    <span className="inline-flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      {produit.missingForPublication.length} élément
                      {produit.missingForPublication.length > 1 ? 's' : ''} manquant
                      {produit.missingForPublication.length > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
                <span className="figures mt-1 block text-xs text-muted-foreground">
                  Achat <Money value={xaf(produit.purchasePriceXaf)} /> · MOQ {produit.moq} ·{' '}
                  {produit.weightGrams} g · modifiée le {dateCourte(produit.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creation && (
        <Card className="grid gap-4">
          <Section
            titre="Nouvelle fiche produit"
            description="Elle est créée en brouillon : rien n’est visible du public avant publication."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ label="Nom" value={form.name} onChange={(v) => setForm({ ...form, name: v })} requis />
              <ChampChoix
                label="Catégorie"
                value={form.category}
                onChange={(v) => v && setForm({ ...form, category: v })}
                options={INTEREST_CATEGORIES.map((categorie) => ({
                  value: categorie,
                  label: INTEREST_CATEGORY_LABELS[categorie],
                }))}
              />
            </div>
            <ChampTexte
              label="Description"
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
              aide="Ce que le produit est, à quoi il sert, ce qui le distingue. 20 caractères minimum."
            />
          </Section>

          <Section
            titre="Prix d’achat et taux"
            description="Le prix en FCFA est recalculé par le serveur à partir du taux : il reste toujours cohérent avec lui."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ChampNombre
                label="Prix unitaire (CNY, en fen)"
                value={form.purchasePriceMinor}
                onChange={(v) => setForm({ ...form, purchasePriceMinor: v })}
                min={1}
              />
              <ChampNombre
                label="Taux CNY → FCFA"
                value={form.exchangeRate}
                onChange={(v) => setForm({ ...form, exchangeRate: v })}
                min={1}
              />
              <Champ
                label="Date du taux"
                type="date"
                value={form.exchangeRateAt}
                onChange={(v) => setForm({ ...form, exchangeRateAt: v })}
                requis
              />
              <Champ
                label="Source du taux"
                value={form.exchangeRateSource}
                onChange={(v) => setForm({ ...form, exchangeRateSource: v })}
                placeholder="BEAC, relevé du 05/10"
                requis
              />
            </div>
          </Section>

          <Section titre="Commande et transport">
            <div className="grid gap-3 sm:grid-cols-3">
              <ChampNombre
                label="Quantité minimum"
                value={form.moq}
                onChange={(v) => setForm({ ...form, moq: v })}
                min={1}
              />
              <ChampNombre
                label="Poids unitaire (g)"
                value={form.weightGrams}
                onChange={(v) => setForm({ ...form, weightGrams: v })}
                min={1}
              />
              <ChampNombre
                label="Volume unitaire (cm³)"
                value={form.volumeCm3}
                onChange={(v) => setForm({ ...form, volumeCm3: v })}
                aide="Laisser à 0 si non mesuré."
              />
            </div>
          </Section>

          <ChampTexte
            label="Points de vigilance"
            value={form.watchPoints}
            onChange={(v) => setForm({ ...form, watchPoints: v })}
            aide="Un par ligne : ce qui peut mal se passer sur ce produit (§13). Obligatoire pour publier."
          />

          <div className="flex gap-2">
            <Button onClick={() => void creer()} loading={enregistrement}>
              Créer le brouillon
            </Button>
            <Button variant="outline" onClick={() => setCreation(false)}>
              Annuler
            </Button>
          </div>
        </Card>
      )}

      {detail && (
        <Card className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{detail.product.name}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {detail.product.categoryLabel} · {detail.product.imageCount} image
                {detail.product.imageCount > 1 ? 's' : ''} ·{' '}
                {detail.product.publishedAt
                  ? `publiée le ${dateCourte(detail.product.publishedAt)}`
                  : 'jamais publiée'}
              </p>
            </div>
            <Badge tone={TON_STATUT[detail.product.status]}>{detail.product.statusLabel}</Badge>
          </div>

          {manques.length > 0 && (
            <div className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-warning">
                <AlertTriangle className="size-4" aria-hidden />
                Il manque ceci pour publier
              </p>
              <ul className="mt-1.5 list-inside list-disc text-muted-foreground">
                {manques.map((manque) => (
                  <li key={manque}>{manque}</li>
                ))}
              </ul>
            </div>
          )}

          <Section
            titre="Publication"
            description="Le motif est obligatoire : il est conservé au journal d’audit avec votre nom."
          >
            <Champ
              label="Motif de la décision"
              value={motif}
              onChange={setMotif}
              placeholder="Fiche complète, relevé de marché à jour"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void changerStatut('PUBLISHED')}
                loading={enregistrement}
                disabled={manques.length > 0 || motif.trim().length < 5 || detail.product.status === 'PUBLISHED'}
              >
                Publier
              </Button>
              <Button
                variant="outline"
                onClick={() => void changerStatut('ARCHIVED')}
                loading={enregistrement}
                disabled={motif.trim().length < 5 || detail.product.status === 'ARCHIVED'}
              >
                Retirer du catalogue
              </Button>
            </div>
          </Section>

          <Section
            titre="Relevé de marché"
            description="Un prix local n’est accepté qu’avec sa date et sa source. Sans elles, le catalogue affiche « pas encore relevé » plutôt qu’un chiffre sans origine."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ChampNombre
                label="Prix local, bas (FCFA)"
                value={marche.localPriceMinXaf}
                onChange={(v) => setMarche({ ...marche, localPriceMinXaf: v })}
              />
              <ChampNombre
                label="Prix local, haut (FCFA)"
                value={marche.localPriceMaxXaf}
                onChange={(v) => setMarche({ ...marche, localPriceMaxXaf: v })}
              />
              <Champ
                label="Date du relevé"
                type="date"
                value={marche.localPriceObservedAt}
                onChange={(v) => setMarche({ ...marche, localPriceObservedAt: v })}
              />
              <Champ
                label="Source du relevé"
                value={marche.localPriceSource}
                onChange={(v) => setMarche({ ...marche, localPriceSource: v })}
                placeholder="Marché Mboppi, relevé terrain"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ChampChoix
                label="Demande locale"
                value={marche.demand}
                onChange={(v) => setMarche({ ...marche, demand: v })}
                vide="Non appréciée"
                options={MARKET_LEVELS.map((niveau) => ({ value: niveau, label: MARKET_LABELS[niveau] }))}
              />
              <ChampChoix
                label="Concurrence"
                value={marche.competition}
                onChange={(v) => setMarche({ ...marche, competition: v })}
                vide="Non appréciée"
                options={MARKET_LEVELS.map((niveau) => ({ value: niveau, label: MARKET_LABELS[niveau] }))}
              />
              <ChampChoix
                label="Risque"
                value={marche.risk}
                onChange={(v) => setMarche({ ...marche, risk: v })}
                vide="Non apprécié"
                options={RISK_LEVELS.map((niveau) => ({ value: niveau, label: RISK_LEVEL_LABELS[niveau] }))}
              />
              <ChampChoix
                label="Facilité de transport"
                value={marche.transportEase}
                onChange={(v) => setMarche({ ...marche, transportEase: v })}
                vide="Non appréciée"
                options={TRANSPORT_EASES.map((niveau) => ({
                  value: niveau,
                  label: TRANSPORT_EASE_LABELS[niveau],
                }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ChampNombre
                label="Capital conseillé (FCFA)"
                value={marche.capitalRequiredXaf}
                onChange={(v) => setMarche({ ...marche, capitalRequiredXaf: v })}
              />
              <Champ
                label="Date de l’appréciation"
                type="date"
                value={marche.assessedAt}
                onChange={(v) => setMarche({ ...marche, assessedAt: v })}
                aide="Obligatoire dès qu’une appréciation est renseignée."
              />
              <Champ
                label="Source de l’appréciation"
                value={marche.assessmentSource}
                onChange={(v) => setMarche({ ...marche, assessmentSource: v })}
              />
            </div>

            <div>
              <Button variant="outline" onClick={() => void enregistrerMarche()} loading={enregistrement}>
                Enregistrer le relevé
              </Button>
            </div>
          </Section>
        </Card>
      )}
    </div>
  );
}
