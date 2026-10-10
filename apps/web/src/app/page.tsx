import {
  SUPPLIER_VERIFICATION_LABELS,
  SUPPLIER_VERIFICATION_LEVELS,
  type AcademyCourseListResponse,
  type SubscriptionPlansResponse,
} from '@ws/contracts';
import { Button, Card, ProvenanceBadge, VerificationBadge } from '@ws/ui';
import { AuScroll, Entree, ElementDeSerie, Serie, TitreRevele, TitreSection } from '@ws/ui';
import { ArrowRight, BookOpen, Compass, PackageSearch, Ship, TrendingUp } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChiffresAccueil } from '@/components/accueil/chiffres';
import { Photo } from '@/components/accueil/photo';
import { FormationsAccueil } from '@/components/accueil/formations';
import { OffresAccueil } from '@/components/accueil/offres';
import { QuickSimulator } from '@/components/quick-simulator';
import { RouteMap } from '@/components/route-map';
import { VISUELS } from '@/content/visuels';
import { fetchPublic } from '@/lib/api-server';

const PILLARS = [
  { key: 'learn', icon: BookOpen },
  { key: 'source', icon: PackageSearch },
  { key: 'import', icon: Ship },
  { key: 'sell', icon: TrendingUp },
] as const;

const LOOP = ['learn', 'find', 'calculate', 'source', 'import', 'receive', 'sell', 'measure', 'repeat'] as const;

/** Ce qui se passe réellement entre la commande et la livraison, dans l'ordre. */
const JOURNEY = ['order', 'warehouse', 'consolidate', 'customs', 'deliver'] as const;

/**
 * Pied de page, en deux colonnes de destinations réelles. Chaque lien mène à un
 * écran qui existe : un pied de page qui renvoie vers des pages à venir est le
 * premier endroit où un visiteur perd confiance.
 */
const FOOTER = {
  explore: [
    { href: '/opportunites', label: 'Opportunités' },
    { href: '/academy', label: 'Academy' },
    { href: '/fournisseurs', label: 'Fournisseurs' },
    { href: '/services', label: 'Services' },
    { href: '/calculateur', label: 'Calculateur' },
  ],
  account: [
    { href: '/connexion', label: 'Se connecter' },
    { href: '/abonnement', label: 'Abonnement' },
    { href: '/tableau-de-bord', label: 'Tableau de bord' },
    { href: '/importations', label: 'Mes importations' },
    { href: '/aide', label: 'Aide' },
  ],
} as const;

/**
 * Page d'accueil.
 *
 * L'ordre des sections est un entonnoir, pas un empilement : on promet (héros), on
 * prouve avec des chiffres relevés, on explique le parcours, on montre ce qui se
 * vend — formations puis abonnements, avec leurs prix —, on laisse essayer le
 * calculateur, on détaille la mécanique, on expose la politique de confiance, puis
 * on propose le premier geste.
 *
 * Les deux sections commerciales sont alimentées par l'API et **peuvent manquer** :
 * `fetchPublic` renvoie `null` au lieu de lever, et la section disparaît. Une
 * vitrine indisponible parce que l'API tousse serait le pire moment pour être
 * indisponible.
 */
export default async function HomePage() {
  const t = await getTranslations();

  // En parallèle : la page n'attend pas deux allers-retours bout à bout.
  const [catalogue, offres] = await Promise.all([
    fetchPublic<AcademyCourseListResponse>('/v1/academy/courses?perPage=6'),
    fetchPublic<SubscriptionPlansResponse>('/v1/offres'),
  ]);

  return (
    <>
      {/*
        Avancement de lecture. Lié au défilement réel, donc il recule quand on remonte :
        une barre d'avancement qui n'avance que dans un sens mentirait sur la position.
      */}
      <div
        aria-hidden
        className="ws-avancement fixed inset-x-0 top-0 z-50 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-imperial to-gold"
      />

      {/* ───── Héros (§9) ───── */}
      <section data-theme="dark" className="relative overflow-hidden bg-charcoal text-foreground">
        {/*
          La photo passe derrière le texte, sous un voile dense. Deux raisons de ne pas
          l'alléger : le titre doit rester lisible sur un écran en plein soleil, et une
          photo trop présente derrière du texte se lit comme du bruit. Elle est là pour
          dire « c'est du vrai commerce », pas pour être regardée.
        */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <Photo visuel={VISUELS.terminal} priorite derive className="size-full opacity-[0.22]" />
          <span className="absolute inset-0 bg-gradient-to-b from-charcoal/70 via-charcoal/85 to-charcoal" />
          <span className="ws-derive absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_10%,rgb(200_16_46/0.35),transparent_70%),radial-gradient(40%_40%_at_0%_100%,rgb(212_165_55/0.18),transparent_70%)]" />
        </div>
        <span
          aria-hidden
          className="ws-flotte pointer-events-none absolute -right-6 top-24 select-none font-display text-[9rem] leading-none font-extrabold text-white/[0.03] md:text-[14rem]"
        >
          进口
        </span>

        {/*
          `flex-wrap` : à 390 px, la marque et les deux boutons ne tiennent pas sur une
          ligne, et le bouton « Commencer » débordait hors de l'écran. La barre passe
          alors sur deux lignes plutôt que de masquer l'entrée vers la connexion, qui
          est la seule de cette page avant le pied.
        */}
        <header className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-4 md:px-6">
          <span className="whitespace-nowrap font-display text-lg font-bold tracking-tight">
            Warrior <span className="text-gold">Sourcing</span>
          </span>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10">
              <Link href="/connexion">{t('nav.login')}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/connexion">{t('nav.start')}</Link>
            </Button>
          </nav>
        </header>

        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-6 md:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-20 lg:pt-12">
          <div>
            <Entree
              geste="label"
              as="p"
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold"
            >
              {t('hero.eyebrow')}
            </Entree>
            <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              <TitreRevele
                delai={0.12}
                lignes={[
                  t('hero.line1'),
                  <span key="2" className="text-imperial">
                    {t('hero.line2')}
                  </span>,
                  <span key="3" className="text-gold">
                    {t('hero.line3')}
                  </span>,
                ]}
              />
            </h1>
            <Entree as="p" delai={0.46} className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              {t('hero.subtitle')}
            </Entree>
            <Serie className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ElementDeSerie auScroll={false} geste="carte" index={0} total={2} delaiBase={0.62}>
                <Button asChild size="lg">
                  <Link href="/connexion">
                    {t('hero.ctaPrimary')}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </ElementDeSerie>
              <ElementDeSerie auScroll={false} geste="carte" index={1} total={2} delaiBase={0.62}>
                {/* Le catalogue se consulte sans compte : c'est la porte d'entrée de
                    ceux qui veulent voir avant de s'inscrire. */}
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  <Link href="/opportunites">
                    <Compass aria-hidden />
                    {t('hero.ctaSecondary')}
                  </Link>
                </Button>
              </ElementDeSerie>
            </Serie>
            <Entree
              as="p"
              delai={0.86}
              className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-white/70"
            >
              {PILLARS.map(({ key }, index) => (
                <span key={key} className="flex items-center gap-3">
                  {index > 0 && (
                    <span aria-hidden className="text-gold">
                      •
                    </span>
                  )}
                  {t(`pillars.${key}.title`)}
                </span>
              ))}
            </Entree>
          </div>

          <Entree
            geste="carte"
            delai={0.3}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-white shadow-raised backdrop-blur-sm"
          >
            <RouteMap label={t('hero.routeLabel')} />
          </Entree>
        </div>
      </section>

      {catalogue && <ChiffresAccueil catalogue={catalogue} />}

      <main>
        {/* ───── Piliers (§3) ───── */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
            <TitreSection>{t('pillars.title')}</TitreSection>
            <Serie className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PILLARS.map(({ key, icon: Icon }, index) => (
                <ElementDeSerie key={key} index={index} total={PILLARS.length} className="h-full">
                  <Card className="ws-eleve h-full">
                    <span className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-imperial-soft text-imperial">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="font-semibold">{t(`pillars.${key}.title`)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t(`pillars.${key}.text`)}</p>
                  </Card>
                </ElementDeSerie>
              ))}
            </Serie>
          </div>
        </section>

        {/* ───── Formations : ce qui se vend, avec ses prix (§26) ───── */}
        {catalogue && <FormationsAccueil catalogue={catalogue} />}

        {/* ───── Simulateur express (§14) ───── */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
            <TitreSection>{t('simulator.title')}</TitreSection>
            <p className="ws-onview mt-4 max-w-2xl text-muted-foreground" suppressHydrationWarning>{t('simulator.subtitle')}</p>
            <AuScroll className="mt-6">
              <QuickSimulator />
            </AuScroll>
          </div>
        </section>

        {/* ───── Ce qui se passe entre la commande et la livraison ───── */}
        <section className="border-b border-border bg-surface-muted">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:px-6 lg:grid-cols-2">
            <AuScroll geste="volet" className="overflow-hidden rounded-xl border border-border shadow-raised">
              <Photo visuel={VISUELS.entrepot} className="aspect-[4/3] w-full" />
            </AuScroll>

            <div>
              <TitreSection surtitre={t('journey.eyebrow')}>{t('journey.title')}</TitreSection>
              <p className="ws-onview mt-4 text-muted-foreground" suppressHydrationWarning>
                {t('journey.text')}
              </p>

              <Serie className="mt-6 grid gap-3" as="ol">
                {JOURNEY.map((etape, index) => (
                  <ElementDeSerie
                    key={etape}
                    as="li"
                    index={index}
                    total={JOURNEY.length}
                    gesteAuScroll="cote"
                    className="flex items-start gap-3"
                  >
                    <span className="figures mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-imperial-soft text-sm font-bold text-imperial">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block font-semibold">{t(`journey.steps.${etape}.title`)}</span>
                      <span className="block text-sm text-muted-foreground">
                        {t(`journey.steps.${etape}.text`)}
                      </span>
                    </span>
                  </ElementDeSerie>
                ))}
              </Serie>

              <div className="ws-onview mt-6" suppressHydrationWarning>
                <Button asChild variant="outline">
                  <Link href="/expedition">
                    {t('journey.cta')}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ───── Abonnements : les formules et leurs prix (§43) ───── */}
        {offres && <OffresAccueil offres={offres} />}

        {/* ───── Boucle centrale ───── */}
        <section data-theme="dark" className="bg-night text-white">
          <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
            <TitreSection>{t('loop.title')}</TitreSection>
            <Serie className="mt-7 flex flex-wrap items-center gap-2" as="ol">
              {LOOP.map((step, index) => (
                <ElementDeSerie
                  key={step}
                  as="li"
                  index={index}
                  total={LOOP.length}
                  gesteAuScroll="cote"
                  className="flex items-center gap-2"
                >
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold">
                    <span className="figures mr-1.5 text-gold">{index + 1}</span>
                    {t(`loop.steps.${step}`)}
                  </span>
                  {index < LOOP.length - 1 && <ArrowRight aria-hidden className="size-4 text-white/40" />}
                </ElementDeSerie>
              ))}
            </Serie>
          </div>
        </section>

        {/* ───── Confiance (§2, §16) ───── */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
            <TitreSection>{t('trust.title')}</TitreSection>
            <Serie className="mt-7 grid gap-4 md:grid-cols-2">
              <ElementDeSerie index={0} total={2} className="h-full">
                <Card className="h-full">
                  <p className="text-sm text-muted-foreground">{t('trust.text')}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ProvenanceBadge provenance="VERIFIED" />
                    <ProvenanceBadge provenance="ESTIMATE" />
                    <ProvenanceBadge provenance="AI_SUGGESTION" />
                  </div>
                </Card>
              </ElementDeSerie>
              <ElementDeSerie index={1} total={2} className="h-full">
                <Card className="h-full">
                  <h3 className="font-display text-lg font-bold">{t('trust.suppliersTitle')}</h3>
                  <ul className="mt-4 space-y-3">
                    {SUPPLIER_VERIFICATION_LEVELS.map((level) => (
                      <li key={level} className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
                        <VerificationBadge level={level} className="shrink-0" />
                        <span className="text-sm text-muted-foreground">
                          {SUPPLIER_VERIFICATION_LABELS[level].meaning}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </ElementDeSerie>
            </Serie>
          </div>
        </section>

        {/* ───── Premier geste ───── */}
        <section data-theme="dark" className="relative overflow-hidden bg-charcoal text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <Photo visuel={VISUELS.navire} className="size-full opacity-[0.16]" />
            <span className="absolute inset-0 bg-gradient-to-b from-charcoal via-charcoal/90 to-charcoal" />
            <span className="ws-derive absolute inset-0 bg-[radial-gradient(50%_60%_at_20%_0%,rgb(200_16_46/0.3),transparent_70%),radial-gradient(40%_50%_at_100%_100%,rgb(212_165_55/0.16),transparent_70%)]" />
          </div>
          <div className="relative mx-auto max-w-3xl px-4 py-16 text-center md:px-6">
            <p className="ws-onview text-[11px] font-semibold uppercase tracking-[0.18em] text-gold" suppressHydrationWarning>
              {t('finalCta.eyebrow')}
            </p>
            <h2 className="ws-onview mt-3 font-display text-2xl font-extrabold tracking-tight text-balance sm:text-4xl" suppressHydrationWarning>
              {t('finalCta.title')}
            </h2>
            <p className="ws-onview mt-4 text-white/70" suppressHydrationWarning>{t('finalCta.text')}</p>
            <Serie className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <ElementDeSerie index={0} total={2}>
                <Button asChild size="lg">
                  <Link href="/connexion">
                    {t('finalCta.primary')}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </ElementDeSerie>
              <ElementDeSerie index={1} total={2}>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  <Link href="/calculateur">{t('finalCta.secondary')}</Link>
                </Button>
              </ElementDeSerie>
            </Serie>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted-foreground md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
          <div>
            <span className="font-display font-bold text-foreground">
              Warrior <span className="text-imperial">Sourcing</span>
            </span>
            <p className="mt-1 max-w-xs">{t('footer.tagline')}</p>
            <p className="mt-4 max-w-xs text-xs">{t('footer.legalNote')}</p>
          </div>

          <nav aria-label={t('footer.explore')}>
            <h2 className="font-semibold text-foreground">{t('footer.explore')}</h2>
            <ul className="mt-2 grid gap-1.5">
              {FOOTER.explore.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-foreground hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t('footer.account')}>
            <h2 className="font-semibold text-foreground">{t('footer.account')}</h2>
            <ul className="mt-2 grid gap-1.5">
              {FOOTER.account.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-foreground hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}
