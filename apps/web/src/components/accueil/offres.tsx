import {
  SUBSCRIPTION_RIGHT_LABELS,
  type SubscriptionPlan,
  type SubscriptionPlansResponse,
} from '@ws/contracts';
import {
  Badge,
  Button,
  Card,
  ConditionsPromotion,
  ElementDeSerie,
  Prix,
  Serie,
  TitreSection,
} from '@ws/ui';
import { ArrowRight, Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

/**
 * Les offres d'abonnement, sur la page d'accueil (§43).
 *
 * Le prix affiché est celui du serveur, remise comprise : la page d'accueil ne
 * recalcule rien, ce qui est la seule façon d'être sûre d'annoncer le montant qui
 * sera réellement débité. Le prix barré, quand il y en a un, est toujours le prix
 * courant de l'offre — jamais une référence gonflée pour simuler une remise (§54).
 *
 * L'offre mise en avant est la plus cher des offres payantes dotée du plus de
 * droits ; elle n'est pas désignée à la main, pour qu'un changement de tarif depuis
 * le back-office n'ait pas besoin d'un déploiement pour être cohérent.
 */
export async function OffresAccueil({ offres }: { offres: SubscriptionPlansResponse }) {
  const t = await getTranslations('plans');
  const plans = offres.plans.filter((plan) => plan.active);
  if (plans.length === 0) return null;

  const enAvant = aMettreEnAvant(plans);
  const libelles = {
    highlighted: t('highlighted'),
    rights: (rights: string) => t('rights', { rights }),
    cta: (plan: SubscriptionPlan) =>
      plan.priceXaf === 0 ? t('startFree') : t('choose', { plan: plan.name }),
  };

  return (
    <section id="abonnements" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <TitreSection surtitre={t('eyebrow')}>{t('title')}</TitreSection>
          <Button asChild variant="outline" className="ws-onview" suppressHydrationWarning>
            <Link href="/abonnement">
              {t('compare')}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        <p className="ws-onview mt-4 max-w-2xl text-sm text-muted-foreground" suppressHydrationWarning>{t('note')}</p>

        <Serie className="mt-7 grid gap-3 md:grid-cols-3">
          {plans.map((plan, index) => (
            <ElementDeSerie key={plan.id} index={index} total={plans.length} className="h-full">
              <CarteOffre plan={plan} enAvant={plan.id === enAvant} libelles={libelles} />
            </ElementDeSerie>
          ))}
        </Serie>
      </div>
    </section>
  );
}

/** Les libellés arrivent déjà traduits : la carte reste un composant muet. */
type Libelles = {
  highlighted: string;
  rights: (rights: string) => string;
  cta: (plan: SubscriptionPlan) => string;
};

function CarteOffre({
  plan,
  enAvant,
  libelles,
}: {
  plan: SubscriptionPlan;
  enAvant: boolean;
  libelles: Libelles;
}) {
  return (
    <Card
      className={`ws-eleve flex h-full flex-col gap-3 ${
        enAvant ? 'border-primary shadow-raised' : ''
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-bold">{plan.name}</h3>
          {enAvant && <Badge tone="brand">{libelles.highlighted}</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
      </div>

      <div>
        <Prix priced={plan.priced} className="text-xl" />
        {plan.priceXaf > 0 && <span className="ml-1 text-xs text-muted-foreground">{plan.periodSuffix}</span>}
        <ConditionsPromotion priced={plan.priced} className="mt-1 block" />
      </div>

      <ul className="grid flex-1 gap-1.5 text-sm">
        {plan.highlights.map((avantage) => (
          <li key={avantage} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            {avantage}
          </li>
        ))}
      </ul>

      {plan.rights.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {libelles.rights(plan.rights.map((droit) => SUBSCRIPTION_RIGHT_LABELS[droit].label).join(', '))}
        </p>
      )}

      <Button asChild variant={enAvant ? 'primary' : 'outline'}>
        <Link href="/abonnement">{libelles.cta(plan)}</Link>
      </Button>
    </Card>
  );
}

/**
 * Offre mise en avant : celle qui ouvre le plus de droits. À égalité de droits, la
 * moins chère — mettre en avant la plus chère à avantages égaux serait trompeur.
 * Rien n'est mis en avant s'il n'existe qu'une offre, ou si aucune n'ouvre de droit.
 */
function aMettreEnAvant(plans: SubscriptionPlan[]): string | null {
  if (plans.length < 2) return null;

  const candidates = plans.filter((plan) => plan.rights.length > 0);
  if (candidates.length === 0) return null;

  return candidates.reduce((meilleure, plan) => {
    if (plan.rights.length > meilleure.rights.length) return plan;
    if (plan.rights.length === meilleure.rights.length && plan.priceXaf < meilleure.priceXaf) return plan;
    return meilleure;
  }).id;
}
