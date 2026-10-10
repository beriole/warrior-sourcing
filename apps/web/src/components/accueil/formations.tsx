import type { AcademyCourseListResponse } from '@ws/contracts';
import { Button, ElementDeSerie, Serie, TitreSection } from '@ws/ui';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AcademyCourseCard } from '@/components/academy/course-card';

/** Au-delà de six cartes, la page d'accueil devient un catalogue : on renvoie à l'Academy. */
const MAX = 6;

/**
 * Les offres de formation, sur la page d'accueil (§26, §43).
 *
 * La carte est **celle de l'Academy**, pas une copie allégée : le prix, la remise,
 * la durée et la condition d'accès s'y affichent déjà selon les mêmes règles. Deux
 * cartes finiraient par annoncer deux prix différents pour la même formation, et
 * c'est la page d'accueil qui aurait tort.
 *
 * Les prix viennent du serveur, promotion comprise. Rien n'est recalculé ici.
 */
export async function FormationsAccueil({ catalogue }: { catalogue: AcademyCourseListResponse }) {
  const t = await getTranslations('academy');
  if (catalogue.items.length === 0) return null;

  const cours = catalogue.items.slice(0, MAX);
  const reste = catalogue.total - cours.length;

  // Composition réelle du catalogue, comptée et non annoncée.
  const gratuites = catalogue.items.filter((item) => item.access === 'FREE').length;
  const payantes = catalogue.items.filter((item) => item.access === 'PAID').length;
  const incluses = catalogue.items.length - gratuites - payantes;
  const parties = [
    gratuites > 0 ? t('free', { count: gratuites }) : null,
    payantes > 0 ? t('paid', { count: payantes }) : null,
    incluses > 0 ? t('included', { count: incluses }) : null,
  ].filter((partie): partie is string => partie !== null);

  return (
    <section id="formations" className="border-b border-border bg-surface-muted">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <TitreSection surtitre={t('eyebrow')}>{t('title')}</TitreSection>
          <Button asChild variant="outline" className="ws-onview" suppressHydrationWarning>
            <Link href="/academy">
              {t('all')}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        <p className="ws-onview mt-4 max-w-2xl text-sm text-muted-foreground" suppressHydrationWarning>
          {t('composition', { count: catalogue.total })}
          {parties.length > 0 ? ` — ${parties.join(', ')}.` : '.'} {t('note')}
        </p>

        <Serie className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cours.map((item, index) => (
            <ElementDeSerie key={item.id} index={index} total={cours.length} className="h-full">
              <div className="ws-eleve h-full">
                <AcademyCourseCard course={item} />
              </div>
            </ElementDeSerie>
          ))}
        </Serie>

        {reste > 0 && (
          <p className="ws-onview mt-5 flex items-center gap-2 text-sm text-muted-foreground" suppressHydrationWarning>
            <GraduationCap className="size-4 shrink-0" aria-hidden />
            {t('more', { count: reste })}
          </p>
        )}
      </div>
    </section>
  );
}
