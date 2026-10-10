'use client';

import {
  PRODUCT_BADGE_LABELS,
  type CatalogProductCard as CatalogProductCardData,
} from '@ws/contracts';
import { Badge, Card, Money, ProvenanceBadge } from '@ws/ui';
import { ImageOff, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { FavoriToggle } from '@/components/favoris/favoris-client';
import { formatDate } from './catalog-client';

/**
 * Carte compacte d'une opportunité (§12).
 *
 * Chaque chiffre porte sa nature et sa date. Une donnée manquante est écrite en toutes
 * lettres : on ne remplace jamais une absence par un chiffre plausible (§54).
 */
export function ProductCard({ product }: { product: CatalogProductCardData }) {
  const margin = product.potentialMargin;

  return (
    <Card className="flex h-full flex-col p-0">
      <Link
        href={`/opportunites/${product.slug}`}
        className="flex h-full flex-col rounded-lg focus-visible:ring-2 focus-visible:ring-imperial focus-visible:outline-none"
      >
        <ProductImage product={product} />

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{product.categoryLabel}</p>
              <h3 className="mt-0.5 line-clamp-2 font-semibold leading-tight">{product.name}</h3>
            </div>
            {/* Le marque-page vit dans le lien de la carte : il arrête la propagation lui-même. */}
            <FavoriToggle targetType="PRODUCT" targetId={product.id} libelle="ce produit" className="-mt-2 -mr-2" />
          </div>

          <dl className="grid gap-1.5 text-sm">
            <Line label="Prix d’achat en Chine">
              <Money value={{ amountMinor: product.purchasePrice.amountMinor, currency: product.purchasePrice.currency }} />
            </Line>

            <Line label="Coût rendu estimé (l’unité)">
              <Money value={{ amountMinor: product.minimumOrder.unitXaf, currency: 'XAF' }} />
            </Line>

            <Line label="Prix local observé">
              {product.localPrice ? (
                <span className="figures">
                  <Money value={{ amountMinor: product.localPrice.minXaf, currency: 'XAF' }} />
                  {' – '}
                  <Money value={{ amountMinor: product.localPrice.maxXaf, currency: 'XAF' }} />
                </span>
              ) : (
                <span className="text-xs font-normal text-muted-foreground">Pas encore relevé</span>
              )}
            </Line>

            <Line label="Marge potentielle (l’unité)">
              {margin ? (
                <span className={margin.unitMarginXaf > 0 ? 'text-success' : 'text-danger'}>
                  <Money value={{ amountMinor: margin.unitMarginXaf, currency: 'XAF' }} />
                  <span className="figures ml-1 text-xs font-normal">({margin.marginPercent} %)</span>
                </span>
              ) : (
                <span className="text-xs font-normal text-muted-foreground">Calcul impossible sans prix local</span>
              )}
            </Line>
          </dl>

          <p className="text-xs text-muted-foreground">
            Commande minimum : <span className="figures">{product.moq}</span> pièces, soit{' '}
            <Money className="font-semibold" value={{ amountMinor: product.minimumOrder.totalXaf, currency: 'XAF' }} />{' '}
            à investir.
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-1.5">
            <ProvenanceBadge provenance="ESTIMATE" />
            {product.localPrice && (
              <Badge tone="verified" title={`Prix local relevé le ${formatDate(product.localPrice.observedAt)}`}>
                Prix relevé le {formatDate(product.localPrice.observedAt)}
              </Badge>
            )}
            {product.market?.demandLabel && (
              <Badge tone="brand">
                <TrendingUp aria-hidden />
                {product.market.demandLabel}
              </Badge>
            )}
            {product.market?.riskLabel && (
              <Badge tone={product.market.risk === 'LOW' ? 'success' : product.market.risk === 'HIGH' ? 'danger' : 'warning'}>
                {product.market.riskLabel}
              </Badge>
            )}
            {product.badges.slice(0, 2).map((badge) => (
              <Badge key={badge} tone="neutral" title={PRODUCT_BADGE_LABELS[badge].description}>
                {PRODUCT_BADGE_LABELS[badge].label}
              </Badge>
            ))}
          </div>
        </div>
      </Link>
    </Card>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-semibold">{children}</dd>
    </div>
  );
}

/**
 * Visuel du produit. Les images sont servies telles quelles (elles peuvent être des
 * données intégrées) : on n'utilise donc pas l'optimiseur d'images, dont la configuration
 * appartient à la plateforme.
 */
function ProductImage({ product }: { product: CatalogProductCardData }) {
  if (!product.image) {
    return (
      <div className="flex aspect-4/3 items-center justify-center rounded-t-lg bg-surface-muted text-muted-foreground">
        <span className="flex flex-col items-center gap-1 text-xs">
          <ImageOff className="size-6" aria-hidden />
          Aucune photo disponible
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- source distante ou intégrée, sans optimiseur
    <img
      src={product.image.url}
      alt={product.image.alt}
      loading="lazy"
      className="aspect-4/3 w-full rounded-t-lg bg-surface-muted object-cover"
    />
  );
}
