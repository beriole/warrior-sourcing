import { cn } from '@ws/ui';
import type { Visuel } from '@/content/visuels';

/**
 * Photographie de la page d'accueil.
 *
 * `next/image` n'est pas utilisé ici, volontairement : ces fichiers sont servis depuis
 * `public/` et déjà dimensionnés pour l'écran. Les passer par l'optimiseur ajouterait
 * un aller-retour serveur au premier affichage, ce qui est précisément ce qu'on ne veut
 * pas sur un réseau mobile — et l'optimiseur n'est pas disponible partout où ce site
 * peut être déployé.
 *
 * `width` et `height` sont toujours donnés : sans eux, le navigateur ne peut pas réserver
 * la place et le texte saute quand l'image arrive.
 */
export function Photo({
  visuel,
  className,
  priorite = false,
  derive = false,
}: {
  visuel: Visuel;
  className?: string;
  /** Vrai pour la photo visible au chargement : elle ne doit pas être différée. */
  priorite?: boolean;
  /** Dérive lente, réservée à une photo de fond. */
  derive?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fichier statique déjà dimensionné
    <img
      src={visuel.src}
      alt={visuel.alt}
      width={visuel.width}
      height={visuel.height}
      loading={priorite ? 'eager' : 'lazy'}
      fetchPriority={priorite ? 'high' : 'auto'}
      decoding="async"
      className={cn('object-cover', derive && 'ws-photo-derive', className)}
    />
  );
}
