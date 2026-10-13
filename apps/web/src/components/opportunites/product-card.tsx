'use client';

import { type CatalogProductCard as CatalogProductCardData } from '@ws/contracts';
import { Card, Money, ProvenanceBadge } from '@ws/ui';
import { ImageOff } from 'lucide-react';
import Link from 'next/link';
import { FavoriToggle } from '@/components/favoris/favoris-client';
import { formatDate } from './catalog-client';

/**
 * Carte d'une opportunité (§12).
 *
 * ## Ce qu'elle ne montre plus
 *
 * Elle portait cinq lignes « libellé : valeur » — prix d'achat en yuans, coût rendu, prix
 * local observé, marge, investissement minimum — suivies de six pastilles. Quinze chiffres
 * sur une vignette de trois cents pixels : on ne lisait rien, et surtout pas le seul
 * chiffre qui décide d'un achat.
 *
 * Reste donc **le coût rendu**, en grand, parce que c'est ce qu'on paie pour avoir la
 * marchandise à Douala ; la marge, parce que c'est ce qu'on vient chercher ; et la
 * commande minimum, parce qu'elle élimine la moitié des produits d'un coup d'œil. Le
 * détail complet — prix d'achat en yuans, fourchette locale, demande, risque,
 * encombrement — vit sur la fiche, où il y a la place de l'expliquer.
 *
 * ## Les deux règles qui survivent au ménage (§54)
 *
 * Le coût rendu reste marqué « Estimation » : c'est un calcul, pas un devis. Et la marge
 * porte la date du relevé de prix local dont elle découle — un pourcentage de marge sans
 * date est une opinion. Sans prix local, aucune marge n'est affichée : la carte n'invente
 * pas le chiffre manquant, elle ne l'affiche pas.
 */
export function ProductCard({ product }: { product: CatalogProductCardData }) {
  const marge = product.potentialMargin;

  return (
    <Card className="group flex h-full flex-col overflow-hidden p-0 transition-shadow duration-200 hover:shadow-lg">
      <Link
        href={`/opportunites/${product.slug}`}
        className="flex h-full flex-col rounded-lg focus-visible:ring-2 focus-visible:ring-imperial focus-visible:outline-none"
      >
        <Visuel product={product} marge={marge} />

        <div className="flex flex-1 flex-col gap-1 p-4">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {product.categoryLabel}
          </p>
          <h3 className="line-clamp-2 min-h-[2.75rem] leading-snug font-semibold">{product.name}</h3>

          <p className="mt-2 flex items-baseline gap-1.5">
            <Money
              className="font-display text-2xl font-bold tracking-tight"
              value={{ amountMinor: product.minimumOrder.unitXaf, currency: 'XAF' }}
            />
            <span className="text-xs text-muted-foreground">coût rendu, l’unité</span>
          </p>

          {marge && product.localPrice && (
            <p className="figures text-xs text-muted-foreground">
              marge estimée d’après un prix relevé le {formatDate(product.localPrice.observedAt)}
            </p>
          )}

          <p className="figures mt-auto pt-2 text-xs text-muted-foreground">
            dès {product.moq} pièces —{' '}
            <Money
              className="font-semibold text-foreground"
              value={{ amountMinor: product.minimumOrder.totalXaf, currency: 'XAF' }}
            />{' '}
            à investir
          </p>
        </div>
      </Link>
    </Card>
  );
}

/**
 * Le visuel et ce qui se lit dessus.
 *
 * La marge est posée sur l'image plutôt que dans le texte : c'est le chiffre qu'on cherche
 * en balayant une grille, et sur un fond sombre il se repère sans lire. Le dégradé n'est
 * pas décoratif — sans lui, une pastille claire sur une photo claire disparaît, et on ne
 * choisit pas la photo que l'administration téléversera.
 */
function Visuel({
  product,
  marge,
}: {
  product: CatalogProductCardData;
  marge: CatalogProductCardData['potentialMargin'];
}) {
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-surface-muted">
      {product.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- source locale, distante ou intégrée
        <img
          src={product.image.url}
          alt={product.image.alt}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
          <ImageOff className="size-6" aria-hidden />
          Aucune photo disponible
        </span>
      )}

      <span className="absolute top-2.5 left-2.5">
        <ProvenanceBadge provenance="ESTIMATE" />
      </span>

      {/* Le marque-page vit dans le lien de la carte : il arrête la propagation lui-même. */}
      <span className="absolute top-1 right-1">
        <FavoriToggle targetType="PRODUCT" targetId={product.id} libelle="ce produit" className="rounded-full bg-night/40 text-white backdrop-blur-sm hover:bg-night/60" />
      </span>

      {marge && (
        <>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-night/70 to-transparent" />
          <span
            className={`figures absolute right-2.5 bottom-2.5 rounded-md px-2 py-1 text-sm font-bold shadow-sm ${
              marge.unitMarginXaf > 0 ? 'bg-success text-white' : 'bg-danger text-white'
            }`}
          >
            {marge.unitMarginXaf > 0 ? '+' : ''}
            {marge.marginPercent} % de marge
          </span>
        </>
      )}
    </div>
  );
}
