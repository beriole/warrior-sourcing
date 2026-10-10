'use client';

import {
  BILLING_PERIODS,
  BILLING_PERIOD_LABELS,
  SUBSCRIPTION_RIGHTS,
  SUBSCRIPTION_RIGHT_LABELS,
  type BillingPeriod,
  type SubscriptionPlan,
  type SubscriptionRight,
} from '@ws/contracts';
import { Badge, Button, Card, Money } from '@ws/ui';
import { Plus, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { appelApi, etatDepuisErreur, xaf, type EtatAcces } from '@/components/admin/api';
import { Champ, ChampChoix, ChampNombre, ChampTexte, Section } from '@/components/admin/champs';
import {
  EcranAcces,
  EnTete,
  EtatVide,
  MessageErreur,
  MessageInfo,
  SqueletteListe,
} from '@/components/admin/etats';

const FORM_VIDE = {
  slug: '',
  name: '',
  tagline: '',
  priceXaf: 0,
  period: 'MONTHLY' as BillingPeriod,
  rights: [] as SubscriptionRight[],
  serviceDiscountPercent: 0,
  highlights: '',
  position: 0,
  active: true,
};

/**
 * Offres d'abonnement (§43).
 *
 * Les prix se modifient ici, pas dans le code : un changement de tarif ne doit pas
 * demander un déploiement.
 *
 * Les droits sont une liste fermée, et c'est volontaire : chacun correspond à une
 * vérification réelle côté serveur. On ne peut donc pas promettre un avantage qui ne
 * serait branché nulle part.
 */
export function OffresView() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
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
    appelApi<{ plans: SubscriptionPlan[] }>('/admin/offres')
      .then((data) => {
        setPlans(data.plans);
        setAcces('ok');
      })
      .catch(traiterErreur)
      .finally(() => setChargement(false));
  }, [version, traiterErreur]);

  function rafraichir() {
    setChargement(true);
    setVersion((v) => v + 1);
  }

  function ouvrirEdition(plan: SubscriptionPlan) {
    setErreur(null);
    setInfo(null);
    setEdition({
      id: plan.id,
      form: {
        slug: plan.slug,
        name: plan.name,
        tagline: plan.tagline,
        priceXaf: plan.priceXaf,
        period: plan.period,
        rights: plan.rights,
        serviceDiscountPercent: plan.serviceDiscountPercent,
        highlights: plan.highlights.join('\n'),
        position: plan.position,
        active: plan.active,
      },
    });
  }

  async function enregistrer() {
    if (!edition) return;
    const { form, id } = edition;
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);

    try {
      const data = await appelApi<{ plans: SubscriptionPlan[] }>(
        id ? `/admin/offres/${id}` : '/admin/offres',
        {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify({
            slug: form.slug.trim().toLowerCase(),
            name: form.name.trim(),
            tagline: form.tagline.trim(),
            priceXaf: form.priceXaf,
            period: form.period,
            rights: form.rights,
            serviceDiscountPercent: form.serviceDiscountPercent,
            highlights: form.highlights
              .split('\n')
              .map((ligne) => ligne.trim())
              .filter(Boolean),
            position: form.position,
            active: form.active,
          }),
        },
      );
      setPlans(data.plans);
      setEdition(null);
      setInfo(id ? 'Offre modifiée.' : 'Offre créée.');
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  if (acces !== 'ok') {
    return <EcranAcces etat={acces} sujet="gérer les offres" onReessayer={rafraichir} />;
  }

  const form = edition?.form;

  return (
    <div className="grid gap-5">
      <EnTete
        titre="Offres d’abonnement"
        sousTitre="Les prix et les droits se définissent ici. Chaque droit correspond à une vérification réelle côté serveur."
        actions={
          <Button onClick={() => setEdition({ id: null, form: FORM_VIDE })}>
            <Plus aria-hidden />
            Nouvelle offre
          </Button>
        }
      />

      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {info && <MessageInfo>{info}</MessageInfo>}

      {edition && form && (
        <Card className="grid gap-4">
          <Section titre={edition.id ? 'Modifier l’offre' : 'Nouvelle offre'}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Champ
                label="Nom"
                value={form.name}
                onChange={(v) => setEdition({ ...edition, form: { ...form, name: v } })}
                requis
              />
              <Champ
                label="Identifiant"
                value={form.slug}
                onChange={(v) => setEdition({ ...edition, form: { ...form, slug: v } })}
                placeholder="pro"
                aide="Minuscules et tirets. Il apparaît dans les URL."
                requis
              />
              <ChampNombre
                label="Rang d’affichage"
                value={form.position}
                onChange={(v) => setEdition({ ...edition, form: { ...form, position: v } })}
                aide="Du plus simple au plus complet."
              />
            </div>

            <Champ
              label="À qui l’offre s’adresse"
              value={form.tagline}
              onChange={(v) => setEdition({ ...edition, form: { ...form, tagline: v } })}
              placeholder="Pour qui importe régulièrement."
              requis
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <ChampNombre
                label="Prix (FCFA)"
                value={form.priceXaf}
                onChange={(v) => setEdition({ ...edition, form: { ...form, priceXaf: v } })}
                aide="0 pour l’offre gratuite."
              />
              <ChampChoix
                label="Rythme"
                value={form.period}
                onChange={(v) => v && setEdition({ ...edition, form: { ...form, period: v } })}
                options={BILLING_PERIODS.map((period) => ({
                  value: period,
                  label: BILLING_PERIOD_LABELS[period].label,
                }))}
              />
              <ChampNombre
                label="Remise sur les prestations (%)"
                value={form.serviceDiscountPercent}
                onChange={(v) => setEdition({ ...edition, form: { ...form, serviceDiscountPercent: v } })}
              />
            </div>
          </Section>

          <Section
            titre="Droits ouverts"
            description="Une offre payante doit ouvrir au moins un droit ou une remise : le serveur refuse une formule qui ne vend rien."
          >
            <ul className="grid gap-2">
              {SUBSCRIPTION_RIGHTS.map((right) => (
                <li key={right}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.rights.includes(right)}
                      onChange={(event) =>
                        setEdition({
                          ...edition,
                          form: {
                            ...form,
                            rights: event.target.checked
                              ? [...form.rights, right]
                              : form.rights.filter((item) => item !== right),
                          },
                        })
                      }
                      className="mt-0.5 size-4 rounded border-border"
                    />
                    <span>
                      <span className="font-medium">{SUBSCRIPTION_RIGHT_LABELS[right].label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {SUBSCRIPTION_RIGHT_LABELS[right].description}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </Section>

          <ChampTexte
            label="Avantages affichés"
            value={form.highlights}
            onChange={(v) => setEdition({ ...edition, form: { ...form, highlights: v } })}
            aide="Un par ligne. N’y mettez que ce que l’offre apporte réellement."
          />

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setEdition({ ...edition, form: { ...form, active: event.target.checked } })}
              className="size-4 rounded border-border"
            />
            Offre proposée au public
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              loading={enregistrement}
              disabled={form.name.trim().length < 2 || form.slug.trim().length < 2 || form.tagline.trim().length < 5}
              onClick={() => void enregistrer()}
            >
              {edition.id ? 'Enregistrer' : 'Créer l’offre'}
            </Button>
            <Button variant="outline" onClick={() => setEdition(null)}>
              Annuler
            </Button>
          </div>
        </Card>
      )}

      {chargement ? (
        <SqueletteListe lignes={3} />
      ) : plans.length === 0 ? (
        <EtatVide
          titre="Aucune offre"
          explication="Créez au moins une offre gratuite et une offre payante pour ouvrir l’abonnement."
        />
      ) : (
        <ul className="grid gap-2">
          {plans.map((plan) => (
            <li key={plan.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{plan.name}</span>
                <Badge tone={plan.active ? 'success' : 'neutral'}>
                  {plan.active ? 'Proposée' : 'Masquée'}
                </Badge>
                <span className="figures font-semibold">
                  {plan.priceXaf === 0 ? 'Gratuit' : <Money value={xaf(plan.priceXaf)} />}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">{plan.periodSuffix}</span>
                </span>
                {plan.priced.discountXaf > 0 && (
                  <Badge tone="brand">
                    En promotion : <Money value={xaf(plan.priced.finalXaf)} />
                  </Badge>
                )}
                <span className="ml-auto">
                  <Button variant="outline" size="sm" onClick={() => ouvrirEdition(plan)}>
                    Modifier
                  </Button>
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden />
                  {plan.subscriberCount ?? 0} abonnement{(plan.subscriberCount ?? 0) > 1 ? 's' : ''}
                </span>
                {plan.rightLabels.length > 0 && <span>{plan.rightLabels.join(' · ')}</span>}
                {plan.serviceDiscountPercent > 0 && (
                  <span>−{plan.serviceDiscountPercent} % sur les prestations</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
