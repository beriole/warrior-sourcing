'use client';

import {
  COURSE_THEMES,
  COURSE_THEME_LABELS,
  DISCOUNT_KINDS,
  DISCOUNT_KIND_LABELS,
  PROMOTION_TARGETS,
  PROMOTION_TARGET_LABELS,
  PROMOTION_TRIGGERS,
  PROMOTION_TRIGGER_LABELS,
  type AdminCourseListResponse,
  type DiscountKind,
  type Promotion,
  type PromotionTarget,
  type PromotionTrigger,
  type SubscriptionPlan,
} from '@ws/contracts';
import { Badge, Button, Card, Money } from '@ws/ui';
import { AlertTriangle, Plus, Tag, Trash2 } from 'lucide-react';
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

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

function enInstant(jour: string): string {
  return new Date(`${jour}T00:00:00.000Z`).toISOString();
}

const FORM_VIDE = {
  name: '',
  description: '',
  kind: 'PERCENTAGE' as DiscountKind,
  percentage: 10,
  amountXaf: 0,
  target: 'ALL_COURSES' as PromotionTarget,
  targetId: '',
  trigger: 'AUTOMATIC' as PromotionTrigger,
  code: '',
  startsAt: aujourdhui(),
  endsAt: '',
  maxRedemptions: 0,
  maxPerCustomer: 1,
  firstPurchaseOnly: false,
  minimumAmountXaf: 0,
  active: true,
};

/**
 * Promotions (§43).
 *
 * Un seul écran pour toutes les remises : formations et abonnements. Le formulaire ne
 * montre que les champs qui comptent pour la forme choisie — un pourcentage et un prix
 * promotionnel ne se saisissent pas de la même façon, et afficher les deux inviterait à
 * remplir celui qui ne sert pas.
 *
 * Chaque promotion affiche son **état réel** et, quand elle ne s'applique pas, la raison
 * exacte : « pas encore commencée », « terminée », « quota atteint ». Une promotion qu'on
 * croit active alors qu'elle ne l'est pas est la panne la plus coûteuse de ce domaine.
 */
export function PromotionsView() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [cours, setCours] = useState<AdminCourseListResponse['items']>([]);
  const [offres, setOffres] = useState<SubscriptionPlan[]>([]);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<EtatAcces>('ok');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [edition, setEdition] = useState<{ id: string | null; form: typeof FORM_VIDE } | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const traiterErreur = useCallback((e: unknown) => {
    const etat = etatDepuisErreur(e);
    if (etat) setAcces(etat);
    else setErreur(e instanceof Error ? e.message : 'Une erreur inattendue s’est produite.');
  }, []);

  useEffect(() => {
    appelApi<{ items: Promotion[]; liveCount: number }>('/admin/promotions')
      .then((data) => {
        setItems(data.items);
        setLiveCount(data.liveCount);
        setAcces('ok');
      })
      .catch(traiterErreur)
      .finally(() => setChargement(false));
  }, [version, traiterErreur]);

  useEffect(() => {
    appelApi<AdminCourseListResponse>('/admin/courses?perPage=100')
      .then((data) => setCours(data.items))
      .catch(() => setCours([]));
    appelApi<{ plans: SubscriptionPlan[] }>('/admin/offres')
      .then((data) => setOffres(data.plans))
      .catch(() => setOffres([]));
  }, [version]);

  function rafraichir() {
    setChargement(true);
    setVersion((v) => v + 1);
  }

  function ouvrirEdition(promotion: Promotion) {
    setErreur(null);
    setInfo(null);
    setEdition({
      id: promotion.id,
      form: {
        name: promotion.name,
        description: promotion.description ?? '',
        kind: promotion.kind,
        percentage: promotion.percentage ?? 10,
        amountXaf: promotion.amountXaf ?? 0,
        target: promotion.target,
        targetId: promotion.targetId ?? '',
        trigger: promotion.trigger,
        code: promotion.code ?? '',
        startsAt: promotion.startsAt.slice(0, 10),
        endsAt: promotion.endsAt?.slice(0, 10) ?? '',
        maxRedemptions: promotion.maxRedemptions ?? 0,
        maxPerCustomer: promotion.maxPerCustomer,
        firstPurchaseOnly: promotion.firstPurchaseOnly,
        minimumAmountXaf: promotion.minimumAmountXaf ?? 0,
        active: promotion.active,
      },
    });
  }

  async function enregistrer() {
    if (!edition) return;
    const { form, id } = edition;
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);

    const corps = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      kind: form.kind,
      percentage: form.kind === 'PERCENTAGE' ? form.percentage : null,
      amountXaf: form.kind === 'AMOUNT' || form.kind === 'FIXED_PRICE' ? form.amountXaf : null,
      target: form.target,
      targetId: form.targetId || null,
      trigger: form.trigger,
      code: form.trigger === 'CODE' ? form.code.trim().toUpperCase() : null,
      startsAt: enInstant(form.startsAt),
      endsAt: form.endsAt ? enInstant(form.endsAt) : null,
      maxRedemptions: form.maxRedemptions > 0 ? form.maxRedemptions : null,
      maxPerCustomer: form.maxPerCustomer,
      firstPurchaseOnly: form.firstPurchaseOnly,
      minimumAmountXaf: form.minimumAmountXaf > 0 ? form.minimumAmountXaf : null,
      active: form.active,
    };

    try {
      const data = await appelApi<{ items: Promotion[]; liveCount: number }>(
        id ? `/admin/promotions/${id}` : '/admin/promotions',
        { method: id ? 'PUT' : 'POST', body: JSON.stringify(corps) },
      );
      setItems(data.items);
      setLiveCount(data.liveCount);
      setEdition(null);
      setInfo(id ? 'Promotion modifiée.' : 'Promotion créée.');
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  async function supprimer(promotion: Promotion) {
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const data = await appelApi<{ items: Promotion[]; liveCount: number }>(
        `/admin/promotions/${promotion.id}`,
        { method: 'DELETE' },
      );
      setItems(data.items);
      setLiveCount(data.liveCount);
      setInfo('Promotion supprimée.');
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  if (acces !== 'ok') {
    return <EcranAcces etat={acces} sujet="gérer les promotions" onReessayer={rafraichir} />;
  }

  const form = edition?.form;
  const viseUnObjet =
    form && (form.target === 'COURSE' || form.target === 'COURSE_THEME' || form.target === 'PLAN');

  return (
    <div className="grid gap-5">
      <EnTete
        titre="Promotions"
        sousTitre="Pourcentage, montant fixe, prix promotionnel ou gratuité — sur une formation, un thème, toutes les formations ou un abonnement."
        actions={
          <Button onClick={() => setEdition({ id: null, form: FORM_VIDE })}>
            <Plus aria-hidden />
            Nouvelle promotion
          </Button>
        }
      />

      <p className="figures text-xs text-muted-foreground">
        {items.length} promotion{items.length > 1 ? 's' : ''} · {liveCount} en vigueur en ce moment
      </p>

      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {info && <MessageInfo>{info}</MessageInfo>}

      {edition && form && (
        <Card className="grid gap-4">
          <Section
            titre={edition.id ? 'Modifier la promotion' : 'Nouvelle promotion'}
            description="Le client ne voit jamais un prix barré supérieur au prix courant : la référence reste le prix de la fiche."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ
                label="Nom interne"
                value={form.name}
                onChange={(v) => setEdition({ ...edition, form: { ...form, name: v } })}
                aide="Il sert à vous repérer, et apparaît sur la fiche du client."
                requis
              />
              <ChampChoix
                label="Forme de la remise"
                value={form.kind}
                onChange={(v) => v && setEdition({ ...edition, form: { ...form, kind: v } })}
                options={DISCOUNT_KINDS.map((kind) => ({ value: kind, label: DISCOUNT_KIND_LABELS[kind].label }))}
                aide={DISCOUNT_KIND_LABELS[form.kind].hint}
              />
            </div>

            {/* Un seul champ de valeur, celui qui correspond à la forme choisie. */}
            {form.kind === 'PERCENTAGE' && (
              <ChampNombre
                label="Pourcentage de remise"
                value={form.percentage}
                onChange={(v) => setEdition({ ...edition, form: { ...form, percentage: v } })}
                min={1}
                aide="De 1 à 100."
              />
            )}
            {form.kind === 'AMOUNT' && (
              <ChampNombre
                label="Montant retiré (FCFA)"
                value={form.amountXaf}
                onChange={(v) => setEdition({ ...edition, form: { ...form, amountXaf: v } })}
                aide="Si la remise dépasse le prix, l’article devient offert — jamais un avoir."
              />
            )}
            {form.kind === 'FIXED_PRICE' && (
              <ChampNombre
                label="Prix promotionnel (FCFA)"
                value={form.amountXaf}
                onChange={(v) => setEdition({ ...edition, form: { ...form, amountXaf: v } })}
                aide="Un prix supérieur au prix courant est ignoré : ce serait une fausse remise."
              />
            )}
            {form.kind === 'FREE' && (
              <p className="text-xs text-muted-foreground">Le prix tombe à zéro : rien d’autre à saisir.</p>
            )}

            <ChampTexte
              label="Phrase montrée au client (facultatif)"
              value={form.description}
              onChange={(v) => setEdition({ ...edition, form: { ...form, description: v } })}
              lignes={2}
              aide="Décrivez l’offre, ne la vantez pas."
            />
          </Section>

          <Section titre="Sur quoi elle porte">
            <div className="grid gap-3 sm:grid-cols-2">
              <ChampChoix
                label="Portée"
                value={form.target}
                onChange={(v) => v && setEdition({ ...edition, form: { ...form, target: v, targetId: '' } })}
                options={PROMOTION_TARGETS.map((target) => ({
                  value: target,
                  label: PROMOTION_TARGET_LABELS[target],
                }))}
              />
              {form.target === 'COURSE' && (
                <ChampChoix
                  label="Formation"
                  value={form.targetId}
                  onChange={(v) => setEdition({ ...edition, form: { ...form, targetId: v } })}
                  vide="Choisir une formation"
                  options={cours.map((item) => ({ value: item.id, label: item.title }))}
                />
              )}
              {form.target === 'COURSE_THEME' && (
                <ChampChoix
                  label="Thème"
                  value={form.targetId}
                  onChange={(v) => setEdition({ ...edition, form: { ...form, targetId: v } })}
                  vide="Choisir un thème"
                  options={COURSE_THEMES.map((theme) => ({ value: theme, label: COURSE_THEME_LABELS[theme] }))}
                />
              )}
              {form.target === 'PLAN' && (
                <ChampChoix
                  label="Offre d’abonnement"
                  value={form.targetId}
                  onChange={(v) => setEdition({ ...edition, form: { ...form, targetId: v } })}
                  vide="Choisir une offre"
                  options={offres.map((item) => ({ value: item.id, label: item.name }))}
                />
              )}
            </div>

            {viseUnObjet && !form.targetId && (
              <p className="text-xs text-warning">Indiquez ce que la promotion vise.</p>
            )}
          </Section>

          <Section titre="Comment elle s’obtient">
            <div className="grid gap-3 sm:grid-cols-2">
              <ChampChoix
                label="Déclenchement"
                value={form.trigger}
                onChange={(v) => v && setEdition({ ...edition, form: { ...form, trigger: v } })}
                options={PROMOTION_TRIGGERS.map((trigger) => ({
                  value: trigger,
                  label: PROMOTION_TRIGGER_LABELS[trigger].label,
                }))}
                aide={PROMOTION_TRIGGER_LABELS[form.trigger].hint}
              />
              {form.trigger === 'CODE' && (
                <Champ
                  label="Code"
                  value={form.code}
                  onChange={(v) => setEdition({ ...edition, form: { ...form, code: v.toUpperCase() } })}
                  placeholder="RENTREE25"
                  aide="Lettres, chiffres et tirets. Il doit se dicter au téléphone sans ambiguïté."
                />
              )}
            </div>
          </Section>

          <Section
            titre="Quand et combien de fois"
            description="Un quota annoncé est un vrai quota : s’il n’y en a pas, laissez à zéro et rien ne sera affiché au client."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Champ
                label="Début"
                type="date"
                value={form.startsAt}
                onChange={(v) => setEdition({ ...edition, form: { ...form, startsAt: v } })}
                requis
              />
              <Champ
                label="Fin (facultatif)"
                type="date"
                value={form.endsAt}
                onChange={(v) => setEdition({ ...edition, form: { ...form, endsAt: v } })}
                aide="Laissez vide pour une offre sans terme annoncé."
              />
              <ChampNombre
                label="Quota total"
                value={form.maxRedemptions}
                onChange={(v) => setEdition({ ...edition, form: { ...form, maxRedemptions: v } })}
                aide="0 = illimité."
              />
              <ChampNombre
                label="Par client"
                value={form.maxPerCustomer}
                onChange={(v) => setEdition({ ...edition, form: { ...form, maxPerCustomer: v } })}
                min={1}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ChampNombre
                label="Montant minimum d’achat (FCFA)"
                value={form.minimumAmountXaf}
                onChange={(v) => setEdition({ ...edition, form: { ...form, minimumAmountXaf: v } })}
                aide="0 = aucune condition de montant."
              />
              <div className="grid gap-2 pt-5">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.firstPurchaseOnly}
                    onChange={(event) =>
                      setEdition({ ...edition, form: { ...form, firstPurchaseOnly: event.target.checked } })
                    }
                    className="size-4 rounded border-border"
                  />
                  Réservée à un premier achat
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      setEdition({ ...edition, form: { ...form, active: event.target.checked } })
                    }
                    className="size-4 rounded border-border"
                  />
                  Active
                </label>
              </div>
            </div>
          </Section>

          <div className="flex flex-wrap gap-2">
            <Button
              loading={enregistrement}
              disabled={form.name.trim().length < 3 || (Boolean(viseUnObjet) && !form.targetId)}
              onClick={() => void enregistrer()}
            >
              {edition.id ? 'Enregistrer' : 'Créer la promotion'}
            </Button>
            <Button variant="outline" onClick={() => setEdition(null)}>
              Annuler
            </Button>
          </div>
        </Card>
      )}

      {chargement ? (
        <SqueletteListe />
      ) : items.length === 0 ? (
        <EtatVide
          titre="Aucune promotion"
          explication="Créez-en une pour remiser une formation, un thème entier ou un abonnement."
        />
      ) : (
        <ul className="grid gap-2">
          {items.map((promotion) => (
            <li key={promotion.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Tag className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="font-semibold">{promotion.name}</span>
                <Badge tone={promotion.live ? 'success' : 'neutral'}>
                  {promotion.live ? 'En vigueur' : 'Inactive'}
                </Badge>
                <Badge tone="neutral">{promotion.kindLabel}</Badge>
                {promotion.code && <Badge tone="brand">{promotion.code}</Badge>}
                <span className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => ouvrirEdition(promotion)}>
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={enregistrement}
                    onClick={() => void supprimer(promotion)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {promotion.kind === 'PERCENTAGE' && `−${promotion.percentage} %`}
                {promotion.kind === 'AMOUNT' && promotion.amountXaf !== null && (
                  <>
                    {'−'}
                    <Money value={xaf(promotion.amountXaf)} />
                  </>
                )}
                {promotion.kind === 'FIXED_PRICE' && promotion.amountXaf !== null && (
                  <>
                    {'à '}
                    <Money value={xaf(promotion.amountXaf)} />
                  </>
                )}
                {promotion.kind === 'FREE' && 'Offert'}
                {' · '}
                {promotion.targetLabel}
                {promotion.targetName && ` : ${promotion.targetName}`}
              </p>

              <p className="figures mt-0.5 text-xs text-muted-foreground">
                Du {dateCourte(promotion.startsAt)}
                {promotion.endsAt ? ` au ${dateCourte(promotion.endsAt)}` : ', sans terme annoncé'}
                {' · '}
                {promotion.redemptionCount} utilisation{promotion.redemptionCount > 1 ? 's' : ''}
                {promotion.maxRedemptions !== null && ` sur ${promotion.maxRedemptions}`}
                {promotion.firstPurchaseOnly && ' · premier achat seulement'}
              </p>

              {promotion.inactiveReason && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  {promotion.inactiveReason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
