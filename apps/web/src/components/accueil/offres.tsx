import { type SubscriptionPlan, type SubscriptionPlansResponse } from '@ws/contracts';
import { Button, ElementDeSerie, Serie, TitreSection } from '@ws/ui';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { aMettreEnAvant, CarteOffre } from '@/components/abonnement/carte-offre';

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
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
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

        <Serie className="mt-8 grid gap-5 md:grid-cols-3">
          {plans.map((plan, index) => (
            <ElementDeSerie key={plan.id} index={index} total={plans.length} className="h-full">
              <CarteAccueil plan={plan} enAvant={plan.id === enAvant} libelles={libelles} />
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

/**
 * Sur l'accueil, aucune carte ne lance de paiement : toutes mènent à `/abonnement`, où le
 * formulaire et le suivi vivent. Une page d'accueil qui encaisse directement obligerait à
 * y porter la gestion du paiement, pour un geste qu'on fait une fois.
 */
function CarteAccueil({
  plan,
  enAvant,
  libelles,
}: {
  plan: SubscriptionPlan;
  enAvant: boolean;
  libelles: Libelles;
}) {
  return (
    <CarteOffre
      plan={plan}
      enAvant={enAvant}
      libelleEnAvant={libelles.highlighted}
      action={
        <Button asChild block variant={enAvant ? 'gold' : plan.priceXaf === 0 ? 'outline' : 'primary'}>
          <Link href="/abonnement">{libelles.cta(plan)}</Link>
        </Button>
      }
    />
  );
}
