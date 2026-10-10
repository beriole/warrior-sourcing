import { SUPPLIER_VERIFICATION_LEVELS, type AcademyCourseListResponse } from '@ws/contracts';
import { ElementDeSerie, Serie } from '@ws/ui';
import { getTranslations } from 'next-intl/server';
import { CompteurAuScroll } from './compteur-au-scroll';

/**
 * Bandeau de chiffres (§54).
 *
 * Chacun est **relevé**, jamais rédigé : le nombre de formations, de leçons et
 * d'heures vient du catalogue lu à l'instant du rendu ; le nombre de niveaux de
 * vérification vient de l'énumération qui les définit. Si le catalogue est vide,
 * la section ne s'affiche pas du tout — un « 0 formation » mis en avant ne rend
 * service à personne, et un chiffre rond inventé encore moins.
 */
export async function ChiffresAccueil({ catalogue }: { catalogue: AcademyCourseListResponse }) {
  const t = await getTranslations('figures');
  if (catalogue.total === 0) return null;

  const lecons = catalogue.items.reduce((somme, cours) => somme + cours.lessonCount, 0);
  const minutes = catalogue.items.reduce((somme, cours) => somme + cours.durationMinutes, 0);
  const heures = Math.round(minutes / 60);

  const chiffres = [
    { cle: 'courses', valeur: catalogue.total, libelle: t('courses', { count: catalogue.total }) },
    { cle: 'lessons', valeur: lecons, libelle: t('lessons', { count: lecons }) },
    // Moins d'une heure de contenu : on l'écrit en minutes plutôt que d'arrondir à zéro.
    heures >= 1
      ? { cle: 'hours', valeur: heures, libelle: t('hours', { count: heures }) }
      : { cle: 'minutes', valeur: minutes, libelle: t('minutes') },
    {
      cle: 'levels',
      valeur: SUPPLIER_VERIFICATION_LEVELS.length,
      libelle: t('verificationLevels'),
    },
  ];

  return (
    <section aria-label={t('label')} className="border-b border-border bg-surface">
      <Serie className="mx-auto grid max-w-6xl gap-x-4 gap-y-6 px-4 py-8 sm:grid-cols-2 md:px-6 lg:grid-cols-4">
        {chiffres.map((chiffre, index) => (
          <ElementDeSerie key={chiffre.cle} index={index} total={chiffres.length}>
            <p className="font-display text-3xl font-extrabold tracking-tight text-imperial sm:text-4xl">
              <CompteurAuScroll valeur={chiffre.valeur} />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{chiffre.libelle}</p>
          </ElementDeSerie>
        ))}
      </Serie>
    </section>
  );
}
