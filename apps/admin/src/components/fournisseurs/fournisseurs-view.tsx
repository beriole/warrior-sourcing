'use client';

import {
  SUPPLIER_PHOTO_KINDS,
  SUPPLIER_PHOTO_KIND_LABELS,
  SUPPLIER_SHOP_PLATFORMS,
  SUPPLIER_SHOP_PLATFORM_LABELS,
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
  SUPPLIER_VERIFICATION_LABELS,
  SUPPLIER_VERIFICATION_LEVELS,
  type AdminSupplierDetailResponse,
  type AdminSupplierListResponse,
  type AdminSupplierResponse,
  type SupplierPhotoKind,
  type SupplierShopPlatform,
  type SupplierType,
  type SupplierVerificationLevel,
} from '@ws/contracts';
import { Badge, Button, Card } from '@ws/ui';
import { ArrowDownRight, ArrowUpRight, FileCheck2, Plus, Search, ShieldAlert, Store, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { appelApi, dateCourte, etatDepuisErreur, type EtatAcces } from '@/components/admin/api';
import { Champ, ChampChoix, ChampNombre, ChampTexte, Section } from '@/components/admin/champs';
import { Vignette } from '@/components/admin/vignette';
import {
  EcranAcces,
  EnTete,
  EtatVide,
  MessageErreur,
  MessageInfo,
  SqueletteListe,
} from '@/components/admin/etats';

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

function enInstant(jour: string): string {
  return new Date(`${jour}T12:00:00.000Z`).toISOString();
}

const NOUVEAU_FOURNISSEUR = {
  name: '',
  type: 'FACTORY' as SupplierType,
  city: '',
  publicSummary: '',
  logoUrl: '',
};

const PHOTO_VIDE = {
  kind: 'FACTORY' as SupplierPhotoKind,
  url: '',
  caption: '',
  takenAt: aujourdhui(),
  takenBy: '',
};

const BOUTIQUE_VIDE = {
  platform: 'C1688' as SupplierShopPlatform,
  url: '',
  label: '',
  verifie: true,
};

const PREUVE_VIDE = {
  level: 'IDENTITY_VERIFIED' as SupplierVerificationLevel,
  evidenceUrl: '',
  notes: '',
  verifiedAt: aujourdhui(),
  reason: '',
};

/**
 * Fournisseurs et niveaux de vérification (ADM-04, §16).
 *
 * L'écran rend visible la règle de fond : **un badge vient d'une preuve**. Le formulaire
 * de changement de niveau exige donc un lien vers le document, et le bouton reste
 * désactivé tant qu'il n'est pas là — le serveur refuserait de toute façon, mais mieux
 * vaut que l'exigence soit lisible avant la frappe plutôt qu'après le refus.
 *
 * Une fiche sans preuve est montrée comme telle, sans euphémisme : c'est l'information
 * la plus utile à qui gère la file de vérification.
 */
export function FournisseursView() {
  const [liste, setListe] = useState<AdminSupplierResponse[]>([]);
  const [parNiveau, setParNiveau] = useState<AdminSupplierListResponse['byLevel']>([]);
  const [villes, setVilles] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<EtatAcces>('ok');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState<SupplierVerificationLevel | 'aucun' | ''>('');
  const [filtreType, setFiltreType] = useState<SupplierType | ''>('');
  const [criteres, setCriteres] = useState({
    recherche: '',
    niveau: '' as SupplierVerificationLevel | 'aucun' | '',
    type: '' as SupplierType | '',
  });
  const [version, setVersion] = useState(0);

  const [detail, setDetail] = useState<AdminSupplierDetailResponse | null>(null);
  const [preuve, setPreuve] = useState(PREUVE_VIDE);
  const [fiche, setFiche] = useState({ publicSummary: '', moq: 0, leadTimeDays: 0, logoUrl: '' });
  const [enregistrement, setEnregistrement] = useState(false);
  const [creation, setCreation] = useState(NOUVEAU_FOURNISSEUR);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [photo, setPhoto] = useState(PHOTO_VIDE);
  const [boutique, setBoutique] = useState(BOUTIQUE_VIDE);

  const traiterErreur = useCallback((e: unknown) => {
    const etat = etatDepuisErreur(e);
    if (etat) setAcces(etat);
    else setErreur(e instanceof Error ? e.message : 'Une erreur inattendue s’est produite.');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (criteres.recherche) params.set('recherche', criteres.recherche);
    if (criteres.niveau) params.set('level', criteres.niveau);
    if (criteres.type) params.set('type', criteres.type);
    appelApi<AdminSupplierListResponse>(`/admin/suppliers?${params.toString()}`)
      .then((data) => {
        setListe(data.items);
        setParNiveau(data.byLevel);
        setVilles(data.cities);
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
    try {
      const data = await appelApi<AdminSupplierDetailResponse>(`/admin/suppliers/${id}`);
      setDetail(data);
      setFiche({
        publicSummary: data.supplier.publicSummary ?? '',
        moq: data.supplier.moq ?? 0,
        leadTimeDays: data.supplier.leadTimeDays ?? 0,
        logoUrl: data.supplier.logoUrl ?? '',
      });
      setPhoto(PHOTO_VIDE);
      setBoutique(BOUTIQUE_VIDE);
      setPreuve({
        ...PREUVE_VIDE,
        // On propose le niveau suivant : c'est le geste le plus fréquent.
        level:
          data.supplier.currentLevel === null
            ? 'IDENTITY_VERIFIED'
            : (SUPPLIER_VERIFICATION_LEVELS[
                Math.min(
                  SUPPLIER_VERIFICATION_LEVELS.indexOf(data.supplier.currentLevel) + 1,
                  SUPPLIER_VERIFICATION_LEVELS.length - 1,
                )
              ] as SupplierVerificationLevel),
      });
    } catch (e) {
      traiterErreur(e);
    }
  }

  async function enregistrerFiche() {
    if (!detail) return;
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const data = await appelApi<AdminSupplierDetailResponse>(`/admin/suppliers/${detail.supplier.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          publicSummary: fiche.publicSummary || null,
          moq: fiche.moq > 0 ? fiche.moq : null,
          leadTimeDays: fiche.leadTimeDays > 0 ? fiche.leadTimeDays : null,
          logoUrl: fiche.logoUrl,
        }),
      });
      setDetail(data);
      setInfo('Fiche enregistrée.');
      rafraichir();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  /**
   * Une action du détail qui renvoie la fiche complète.
   *
   * Les quatre gestes — ajouter une photo, la retirer, ajouter une boutique, la retirer —
   * font exactement la même chose autour de l'appel : effacer les messages, poser l'état
   * d'attente, remplacer le détail, le relâcher. Les écrire quatre fois, c'est se préparer
   * à oublier le `finally` sur l'un d'eux, et à laisser le bouton tourner indéfiniment.
   */
  async function agirSurDetail(chemin: string, init: RequestInit, message: string) {
    if (!detail) return;
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const data = await appelApi<AdminSupplierDetailResponse>(
        `/admin/suppliers/${detail.supplier.id}${chemin}`,
        init,
      );
      setDetail(data);
      setInfo(message);
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  async function creerFournisseur() {
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const data = await appelApi<AdminSupplierDetailResponse>('/admin/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          name: creation.name,
          type: creation.type,
          city: creation.city,
          publicSummary: creation.publicSummary || null,
          logoUrl: creation.logoUrl || null,
        }),
      });
      setDetail(data);
      setFiche({
        publicSummary: data.supplier.publicSummary ?? '',
        moq: 0,
        leadTimeDays: 0,
        logoUrl: data.supplier.logoUrl ?? '',
      });
      setCreation(NOUVEAU_FOURNISSEUR);
      setCreationOuverte(false);
      setInfo('Fournisseur créé. Il n’a encore aucun niveau de vérification : la preuve vient ensuite.');
      rafraichir();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  async function ajouterPhoto() {
    await agirSurDetail(
      '/photos',
      {
        method: 'POST',
        body: JSON.stringify({
          kind: photo.kind,
          url: photo.url,
          caption: photo.caption || null,
          takenAt: enInstant(photo.takenAt),
          takenBy: photo.takenBy,
        }),
      },
      'Photo ajoutée.',
    );
    setPhoto(PHOTO_VIDE);
  }

  async function ajouterBoutique() {
    await agirSurDetail(
      '/boutiques',
      {
        method: 'POST',
        body: JSON.stringify({
          platform: boutique.platform,
          url: boutique.url,
          label: boutique.label || null,
          // La date de contrôle n'est posée que si la case est cochée : personne ne doit
          // pouvoir dater un contrôle qu'il n'a pas fait en remplissant un formulaire.
          checkedAt: boutique.verifie ? new Date().toISOString() : null,
          position: 0,
        }),
      },
      'Boutique enregistrée.',
    );
    setBoutique(BOUTIQUE_VIDE);
  }

  async function changerNiveau() {
    if (!detail) return;
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      await appelApi(`/admin/suppliers/${detail.supplier.id}/verifications`, {
        method: 'POST',
        body: JSON.stringify({
          level: preuve.level,
          evidenceUrl: preuve.evidenceUrl,
          notes: preuve.notes || null,
          verifiedAt: enInstant(preuve.verifiedAt),
          reason: preuve.reason,
        }),
      });
      await ouvrir(detail.supplier.id);
      setInfo('Niveau enregistré avec sa preuve. Le changement figure au journal d’audit.');
      rafraichir();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  if (acces !== 'ok') {
    return <EcranAcces etat={acces} sujet="gérer les fournisseurs" onReessayer={rafraichir} />;
  }

  const sansPreuve = parNiveau.find((item) => item.level === null)?.count ?? 0;
  const preuveValide =
    preuve.evidenceUrl.trim().startsWith('http') && preuve.reason.trim().length >= 10;

  return (
    <div className="grid gap-5">
      <EnTete
        titre="Fournisseurs"
        sousTitre="Chaque niveau de vérification repose sur une preuve enregistrée et datée. Sans document consultable, aucun badge."
      />

      <div>
        <Button onClick={() => setCreationOuverte(!creationOuverte)}>
          <Plus aria-hidden />
          {creationOuverte ? 'Fermer' : 'Ajouter un fournisseur'}
        </Button>
      </div>

      {creationOuverte && (
        <Card className="grid gap-4">
          <Section
            titre="Nouveau fournisseur"
            description="Il naît sans niveau de vérification. Le badge s’obtient ensuite, par une preuve consultable."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ
                label="Nom"
                value={creation.name}
                onChange={(v) => setCreation({ ...creation, name: v })}
                requis
                placeholder="Shenzhen Hanyu Electronics"
              />
              <Champ
                label="Ville"
                value={creation.city}
                onChange={(v) => setCreation({ ...creation, city: v })}
                requis
                placeholder="Shenzhen, Guangdong"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChampChoix
                label="Type"
                value={creation.type}
                onChange={(v) => v && setCreation({ ...creation, type: v })}
                options={SUPPLIER_TYPES.map((type) => ({ value: type, label: SUPPLIER_TYPE_LABELS[type] }))}
              />
              <Champ
                label="Visuel (URL)"
                type="url"
                value={creation.logoUrl}
                onChange={(v) => setCreation({ ...creation, logoUrl: v })}
                aide="Logo ou photo d’atelier. Laissez vide : les initiales s’affichent à la place."
              />
            </div>
            <ChampTexte
              label="Résumé public"
              value={creation.publicSummary}
              onChange={(v) => setCreation({ ...creation, publicSummary: v })}
              lignes={3}
              aide="Ce que l’importateur lit avant d’ouvrir la fiche."
            />
            <div>
              <Button
                onClick={() => void creerFournisseur()}
                loading={enregistrement}
                disabled={creation.name.trim().length < 2 || creation.city.trim().length < 2}
              >
                Créer le fournisseur
              </Button>
            </div>
          </Section>
        </Card>
      )}

      {sansPreuve > 0 && (
        <p className="inline-flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          {sansPreuve} fiche{sansPreuve > 1 ? 's' : ''} ne porte{sansPreuve > 1 ? 'nt' : ''} encore aucune
          preuve : aucun badge n’est affiché côté public pour {sansPreuve > 1 ? 'elles' : 'elle'}.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid flex-1 gap-1 text-xs font-medium text-muted-foreground sm:max-w-xs">
          Rechercher
          <input
            value={recherche}
            placeholder="Nom ou ville"
            onChange={(event) => setRecherche(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter')
                setCriteres({ recherche, niveau: filtreNiveau, type: filtreType });
            }}
            className="h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
          />
        </label>
        <ChampChoix
          label="Niveau atteint"
          value={filtreNiveau}
          onChange={setFiltreNiveau}
          vide="Tous"
          options={[
            { value: 'aucun' as const, label: 'Aucune preuve' },
            ...SUPPLIER_VERIFICATION_LEVELS.map((niveau) => ({
              value: niveau,
              label: SUPPLIER_VERIFICATION_LABELS[niveau].label,
            })),
          ]}
        />
        <ChampChoix
          label="Type"
          value={filtreType}
          onChange={setFiltreType}
          vide="Tous"
          options={SUPPLIER_TYPES.map((type) => ({ value: type, label: SUPPLIER_TYPE_LABELS[type] }))}
        />
        <Button
          variant="outline"
          onClick={() => setCriteres({ recherche, niveau: filtreNiveau, type: filtreType })}
        >
          <Search aria-hidden />
          Filtrer
        </Button>
      </div>

      <p className="figures text-xs text-muted-foreground">
        {total} fournisseur{total > 1 ? 's' : ''}
        {villes.length > 0 && ` — ${villes.length} ville${villes.length > 1 ? 's' : ''} représentée${villes.length > 1 ? 's' : ''}`}
      </p>

      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {info && <MessageInfo>{info}</MessageInfo>}

      {chargement ? (
        <SqueletteListe />
      ) : liste.length === 0 ? (
        <EtatVide
          titre="Aucun fournisseur ne correspond"
          explication="Modifiez la recherche ou retirez un filtre."
        />
      ) : (
        <ul className="grid gap-2">
          {liste.map((fournisseur) => (
            <li key={fournisseur.id}>
              <button
                type="button"
                onClick={() => void ouvrir(fournisseur.id)}
                aria-current={detail?.supplier.id === fournisseur.id ? 'true' : undefined}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  detail?.supplier.id === fournisseur.id
                    ? 'border-primary bg-surface-muted'
                    : 'border-border bg-surface hover:bg-surface-muted'
                }`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{fournisseur.name}</span>
                  <Badge tone="neutral">{fournisseur.typeLabel}</Badge>
                  {fournisseur.currentLevelLabel ? (
                    <Badge tone="success">{fournisseur.currentLevelLabel}</Badge>
                  ) : (
                    <Badge tone="warning">Aucune preuve</Badge>
                  )}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {fournisseur.city} · {fournisseur.verificationCount} preuve
                  {fournisseur.verificationCount > 1 ? 's' : ''}
                  {fournisseur.currentLevelSince &&
                    ` · niveau atteint le ${dateCourte(fournisseur.currentLevelSince)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {detail && (
        <Card className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{detail.supplier.name}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {detail.supplier.typeLabel} · {detail.supplier.city}
              </p>
            </div>
            {detail.supplier.currentLevelLabel ? (
              <Badge tone="success">{detail.supplier.currentLevelLabel}</Badge>
            ) : (
              <Badge tone="warning">Aucune preuve</Badge>
            )}
          </div>

          <Section titre="Informations publiques">
            <ChampTexte
              label="Résumé public"
              value={fiche.publicSummary}
              onChange={(v) => setFiche({ ...fiche, publicSummary: v })}
              lignes={3}
              aide="Ce que l’importateur lit avant d’acheter l’accès aux coordonnées."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <ChampNombre
                label="Quantité minimum"
                value={fiche.moq}
                onChange={(v) => setFiche({ ...fiche, moq: v })}
                aide="0 si le fournisseur n’en impose pas."
              />
              <ChampNombre
                label="Délai annoncé (jours)"
                value={fiche.leadTimeDays}
                onChange={(v) => setFiche({ ...fiche, leadTimeDays: v })}
                aide="0 si le délai n’a pas été communiqué."
              />
            </div>
            <Champ
              label="Visuel (URL)"
              type="url"
              value={fiche.logoUrl}
              onChange={(v) => setFiche({ ...fiche, logoUrl: v })}
              aide="Logo ou photo d’atelier. Videz le champ pour retirer l’image."
            />
            <div>
              <Button variant="outline" onClick={() => void enregistrerFiche()} loading={enregistrement}>
                Enregistrer la fiche
              </Button>
            </div>
          </Section>

          <Section
            titre="Photos de la fiche"
            description="Date et auteur sont exigés : une photo sans eux est une illustration, pas une preuve — et elle s’afficherait pourtant à côté d’un badge."
          >
            {detail.photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune photo déposée.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {detail.photos.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-surface p-2"
                  >
                    <Vignette url={p.url} />
                    <span className="min-w-0 flex-1 text-xs">
                      <span className="block font-semibold">{p.kindLabel}</span>
                      <span className="block text-muted-foreground">
                        {dateCourte(p.takenAt)}
                        {p.takenBy ? ` · ${p.takenBy}` : ''}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Retirer cette photo"
                      onClick={() =>
                        void agirSurDetail(`/photos/${p.id}`, { method: 'DELETE' }, 'Photo retirée.')
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <ChampChoix
                label="Nature"
                value={photo.kind}
                onChange={(v) => v && setPhoto({ ...photo, kind: v })}
                options={SUPPLIER_PHOTO_KINDS.map((kind) => ({
                  value: kind,
                  label: SUPPLIER_PHOTO_KIND_LABELS[kind],
                }))}
              />
              <Champ
                label="Date de prise de vue"
                type="date"
                value={photo.takenAt}
                onChange={(v) => setPhoto({ ...photo, takenAt: v })}
                requis
              />
            </div>
            <Champ
              label="Adresse de l’image"
              type="url"
              value={photo.url}
              onChange={(v) => setPhoto({ ...photo, url: v })}
              requis
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ
                label="Prise par"
                value={photo.takenBy}
                onChange={(v) => setPhoto({ ...photo, takenBy: v })}
                requis
                placeholder="Agent Chine, inspection, fournisseur…"
              />
              <Champ
                label="Légende"
                value={photo.caption}
                onChange={(v) => setPhoto({ ...photo, caption: v })}
              />
            </div>
            <div>
              <Button
                variant="outline"
                onClick={() => void ajouterPhoto()}
                loading={enregistrement}
                disabled={!photo.url || photo.takenBy.trim().length < 2}
              >
                Ajouter la photo
              </Button>
            </div>
          </Section>

          <Section
            titre="Boutiques en ligne"
            description="Publiques, à la différence des coordonnées : une vitrine 1688 ou Alibaba se trouve déjà en une recherche."
          >
            {detail.shopLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune boutique enregistrée.</p>
            ) : (
              <ul className="grid gap-2">
                {detail.shopLinks.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <Store className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 text-xs">
                      <span className="block font-semibold">{b.label ?? b.platformLabel}</span>
                      <span className="block truncate text-muted-foreground">{b.url}</span>
                      <span className="block text-muted-foreground">
                        {b.checkedAt ? `Vérifié le ${dateCourte(b.checkedAt)}` : 'Lien non vérifié'}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Retirer cette boutique"
                      onClick={() =>
                        void agirSurDetail(`/boutiques/${b.id}`, { method: 'DELETE' }, 'Boutique retirée.')
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <ChampChoix
                label="Plateforme"
                value={boutique.platform}
                onChange={(v) => v && setBoutique({ ...boutique, platform: v })}
                options={SUPPLIER_SHOP_PLATFORMS.map((plateforme) => ({
                  value: plateforme,
                  label: SUPPLIER_SHOP_PLATFORM_LABELS[plateforme],
                }))}
              />
              <Champ
                label="Nom de la boutique"
                value={boutique.label}
                onChange={(v) => setBoutique({ ...boutique, label: v })}
                aide="Vide : on affiche le nom de la plateforme."
              />
            </div>
            <Champ
              label="Adresse de la boutique"
              type="url"
              value={boutique.url}
              onChange={(v) => setBoutique({ ...boutique, url: v })}
              requis
              placeholder="https://..."
            />
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={boutique.verifie}
                onChange={(event) => setBoutique({ ...boutique, verifie: event.target.checked })}
                className="size-4"
              />
              J’ai ouvert ce lien et il fonctionne
            </label>
            <div>
              <Button
                variant="outline"
                onClick={() => void ajouterBoutique()}
                loading={enregistrement}
                disabled={!boutique.url}
              >
                Enregistrer la boutique
              </Button>
            </div>
          </Section>

          <Section
            titre="Changer le niveau de vérification"
            description="La preuve est obligatoire, y compris pour abaisser un niveau : retirer un badge engage autant que l’accorder."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <ChampChoix
                label="Niveau"
                value={preuve.level}
                onChange={(v) => v && setPreuve({ ...preuve, level: v })}
                options={SUPPLIER_VERIFICATION_LEVELS.map((niveau) => ({
                  value: niveau,
                  label: SUPPLIER_VERIFICATION_LABELS[niveau].label,
                }))}
                aide={SUPPLIER_VERIFICATION_LABELS[preuve.level].meaning}
              />
              <Champ
                label="Date du contrôle"
                type="date"
                value={preuve.verifiedAt}
                onChange={(v) => setPreuve({ ...preuve, verifiedAt: v })}
                requis
                aide="La date du contrôle, pas celle de la saisie."
              />
            </div>
            <Champ
              label="Lien vers la preuve"
              type="url"
              value={preuve.evidenceUrl}
              onChange={(v) => setPreuve({ ...preuve, evidenceUrl: v })}
              placeholder="https://…/rapport-inspection.pdf"
              requis
              aide="Document consultable : rapport d’inspection, licence, facture de commande test."
            />
            <Champ
              label="Motif"
              value={preuve.reason}
              onChange={(v) => setPreuve({ ...preuve, reason: v })}
              placeholder="Commande test reçue conforme le 12/09"
              aide="10 caractères minimum. Conservé au journal d’audit avec votre nom."
            />
            <ChampTexte
              label="Notes internes"
              value={preuve.notes}
              onChange={(v) => setPreuve({ ...preuve, notes: v })}
              lignes={2}
            />
            <div>
              <Button onClick={() => void changerNiveau()} loading={enregistrement} disabled={!preuveValide}>
                <FileCheck2 aria-hidden />
                Enregistrer le niveau et sa preuve
              </Button>
            </div>
          </Section>

          <Section titre="Preuves enregistrées">
            {detail.verifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune preuve pour l’instant : aucun badge n’est affiché côté public.
              </p>
            ) : (
              <ul className="grid gap-2">
                {detail.verifications.map((verification) => (
                  <li key={verification.id} className="rounded-md border border-border p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {verification.levelLabel}
                      <span className="text-xs font-normal text-muted-foreground">
                        {dateCourte(verification.verifiedAt)}
                        {verification.verifiedByName && ` · ${verification.verifiedByName}`}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{verification.levelMeaning}</p>
                    {verification.evidenceUrl && (
                      <a
                        href={verification.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-semibold text-primary underline"
                      >
                        Ouvrir la preuve
                      </a>
                    )}
                    {verification.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">{verification.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section titre="Historique des décisions">
            {detail.changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun changement de niveau enregistré.</p>
            ) : (
              <ul className="grid gap-2">
                {detail.changes.map((changement) => (
                  <li key={changement.id} className="flex items-start gap-2 text-sm">
                    {changement.demotion ? (
                      <ArrowDownRight className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                    ) : (
                      <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    )}
                    <span>
                      <span className="font-semibold">
                        {changement.fromLevelLabel ?? 'Aucun niveau'} → {changement.toLevelLabel}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {changement.reason} · {dateCourte(changement.decidedAt)}
                        {changement.decidedByName && ` · ${changement.decidedByName}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </Card>
      )}
    </div>
  );
}
