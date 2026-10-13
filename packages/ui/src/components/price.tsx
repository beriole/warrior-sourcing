import { discountLabel, type Priced } from '@ws/contracts';
import { cn } from '../lib/utils';
import { Money } from './money';

/**
 * Prix d'un article, promotion comprise.
 *
 * Le prix barré est **toujours** le prix courant de la fiche, jamais une référence
 * gonflée : c'est le serveur qui fournit les deux montants, et il ne construit `original`
 * qu'à partir du prix réellement pratiqué (§54).
 *
 * Quand aucune promotion ne s'applique, il ne reste qu'un montant : pas de « −0 % », pas
 * de barré inutile. L'interface n'a donc qu'un seul composant pour les deux cas.
 */
export function Prix({
  priced,
  className,
  tailleEtiquette = 'normale',
  taille = 'normale',
}: {
  priced: Priced;
  className?: string;
  /** « petite » pour une carte dense, « normale » pour une fiche. */
  tailleEtiquette?: 'petite' | 'normale';
  /**
   * « geante » pour une grille d'offres : seul le **montant à payer** grossit.
   *
   * Le prix barré et l'étiquette de remise gardent leur taille. Agrandir l'ensemble en
   * posant une classe de texte sur le composant depuis l'extérieur les grossirait aussi,
   * et un prix d'avant écrit aussi gros que le prix du jour se lit mal — on ne saurait
   * plus lequel des deux on paie.
   */
  taille?: 'normale' | 'geante';
}) {
  const etiquette = discountLabel(priced);
  const montant = taille === 'geante' ? 'font-display text-4xl font-bold tracking-tight' : 'font-semibold';

  if (priced.free && priced.originalXaf === 0) {
    return <span className={cn(montant, className)}>Gratuit</span>;
  }

  if (!etiquette) {
    return <Money className={cn(montant, className)} value={xaf(priced.finalXaf)} />;
  }

  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      {priced.free ? (
        <span className={cn(montant, 'text-success')}>Offert</span>
      ) : (
        <Money className={montant} value={xaf(priced.finalXaf)} />
      )}
      {/* Le prix d'avant, annoncé comme tel aux lecteurs d'écran. */}
      <s className="text-sm font-normal text-muted-foreground">
        <span className="sr-only">Prix habituel : </span>
        <Money value={xaf(priced.originalXaf)} />
      </s>
      <span
        className={cn(
          'rounded-full bg-success-soft px-1.5 font-semibold text-success',
          tailleEtiquette === 'petite' ? 'text-[11px]' : 'text-xs',
        )}
      >
        {etiquette}
      </span>
    </span>
  );
}

/**
 * Ce qui accompagne un prix remisé : fin de l'offre et quota restant, seulement quand ils
 * existent réellement. Rien n'est affiché sinon — pas de compte à rebours décoratif.
 */
export function ConditionsPromotion({ priced, className }: { priced: Priced; className?: string }) {
  if (priced.discountXaf === 0) return null;
  const morceaux: string[] = [];

  if (priced.promotionEndsAt) {
    morceaux.push(
      `jusqu’au ${new Date(priced.promotionEndsAt).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
      })}`,
    );
  }
  if (priced.remainingRedemptions !== null) {
    morceaux.push(
      priced.remainingRedemptions === 0
        ? 'quota atteint'
        : `${priced.remainingRedemptions} restante${priced.remainingRedemptions > 1 ? 's' : ''}`,
    );
  }
  if (morceaux.length === 0) return null;

  return (
    <span className={cn('text-xs text-muted-foreground', className)}>
      {priced.promotionName} — {morceaux.join(', ')}
    </span>
  );
}

const xaf = (amountMinor: number) => ({ amountMinor, currency: 'XAF' as const });
