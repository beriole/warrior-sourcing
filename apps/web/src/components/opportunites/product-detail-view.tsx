'use client';

import { PRODUCT_BADGE_LABELS, type CatalogProductDetail } from '@ws/contracts';
import { Badge, Button, Card, Money, ProvenanceBadge, Skeleton } from '@ws/ui';
import { AlertTriangle, ArrowLeft, Calculator, Factory, ImageOff, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatDate, useCatalogProduct } from './catalog-client';
import { InvestmentSimulator } from './investment-simulator';

/**
 * Fiche produit (§13).
 *
 * Galerie, coûts estimés détaillés, fourchette de prix local datée, marge et ses
 * hypothèses, points de vigilance, fournisseurs associés, puis simulateur.
 * Aucune donnée manquante n'est comblée : elle est annoncée comme manquante.
 */
export function ProductDetailView({ idOrSlug }: { idOrSlug: string }) {
  const { data, isPending, isError, error, refetch, isRefetching } = useCatalogProduct(idOrSlug);

  if (isPending) return <DetailSkeleton />;

  if (isError) {
    return (
      <Wrapper>
        <Card className="text-center">
          <h1 className="font-display text-lg font-bold">Cette fiche n’a pas pu être chargée</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={() => void refetch()} loading={isRefetching}>
              <RefreshCw aria-hidden />
              Réessayer
            </Button>
            <Button asChild variant="outline">
              <Link href="/opportunites">Revenir aux opportunités</Link>
            </Button>
          </div>
        </Card>
      </Wrapper>
    );
  }

  const product = data.product;
  const margin = product.potentialMargin;

  return (
    <Wrapper>
      <Link href="/opportunites" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
        <ArrowLeft className="size-4" aria-hidden />
        Toutes les opportunités
      </Link>

      <div className="grid gap-5 lg:grid-cols-2">
        <Gallery product={product} />

        <div className="grid content-start gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{product.categoryLabel}</p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">{product.name}</h1>
          </div>

          <p className="text-sm text-muted-foreground">{product.description}</p>

          {product.badges.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {product.badges.map((badge) => (
                <li key={badge}>
                  <Badge tone="neutral" title={PRODUCT_BADGE_LABELS[badge].description}>
                    {PRODUCT_BADGE_LABELS[badge].label}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          <Card className="grid gap-2">
            <Row label="Prix d’achat en Chine">
              <Money
                value={{
                  amountMinor: product.purchasePrice.amountMinor,
                  currency: product.purchasePrice.currency,
                }}
              />
            </Row>
            <Row label="Soit, converti">
              <Money value={{ amountMinor: product.purchasePrice.amountXaf, currency: 'XAF' }} />
            </Row>
            <Row label="Quantité minimum">
              <span className="figures">{product.moq} pièces</span>
            </Row>
            <Row label="Poids unitaire">
              <span className="figures">{product.weightGrams} g</span>
            </Row>
            {product.volumeCm3 !== null && (
              <Row label="Volume unitaire">
                <span className="figures">{product.volumeCm3} cm³</span>
              </Row>
            )}
            <p className="text-xs text-muted-foreground">
              Conversion au taux de {product.purchasePrice.exchangeRate} FCFA pour 1{' '}
              {product.purchasePrice.currency}, relevé le{' '}
              {formatDate(product.purchasePrice.exchangeRateObservedAt)} (
              {product.purchasePrice.exchangeRateSource}).
            </p>
          </Card>

          <Button asChild block>
            <Link href="#simulateur">
              <Calculator aria-hidden />
              Simuler mon investissement
            </Link>
          </Button>
        </div>
      </div>

      <section aria-labelledby="couts">
        <h2 id="couts" className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Coûts estimés pour la commande minimum
        </h2>
        <Card className="grid gap-2">
          <Row label="Marchandise">
            <Money value={{ amountMinor: product.minimumOrder.merchandiseXaf, currency: 'XAF' }} />
          </Row>
          <Row label="Fret">
            <Money value={{ amountMinor: product.minimumOrder.freightXaf, currency: 'XAF' }} />
          </Row>
          <Row label="Frais de service">
            <Money value={{ amountMinor: product.minimumOrder.serviceFeeXaf, currency: 'XAF' }} />
          </Row>
          <Row label="Droits et taxes estimés">
            <Money value={{ amountMinor: product.minimumOrder.customsXaf, currency: 'XAF' }} />
          </Row>
          <div className="mt-1 border-t border-border pt-2">
            <Row label={`Total pour ${product.minimumOrder.quantity} pièces`}>
              <Money className="text-base" value={{ amountMinor: product.minimumOrder.totalXaf, currency: 'XAF' }} />
            </Row>
            <Row label="Coût rendu par pièce">
              <Money className="text-base" value={{ amountMinor: product.minimumOrder.unitXaf, currency: 'XAF' }} />
            </Row>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProvenanceBadge provenance="ESTIMATE" />
            <span className="text-xs text-muted-foreground">Hypothèses retenues, datées et sourcées :</span>
          </div>
          <ul className="grid gap-1 text-xs text-muted-foreground">
            {product.costAssumptions.map((assumption) => (
              <li key={assumption.label}>
                <span className="font-medium text-foreground">{assumption.label}</span> : {assumption.detail} —{' '}
                {assumption.source}, relevé le {formatDate(assumption.observedAt)}.
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{product.estimateWarning}</p>
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="prix-local">
          <h2 id="prix-local" className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Prix local observé
          </h2>
          <Card className="h-full">
            {product.localPrice ? (
              <>
                <p className="figures text-xl font-bold">
                  <Money value={{ amountMinor: product.localPrice.minXaf, currency: 'XAF' }} />
                  {' – '}
                  <Money value={{ amountMinor: product.localPrice.maxXaf, currency: 'XAF' }} />
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ProvenanceBadge provenance={product.localPrice.provenance} />
                  <span className="text-xs text-muted-foreground">
                    Relevé le {formatDate(product.localPrice.observedAt)} — {product.localPrice.source}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun prix local n’a encore été relevé pour ce produit. Tant que ce relevé n’existe pas, nous
                n’affichons ni marge ni chiffre d’affaires potentiel.
              </p>
            )}
          </Card>
        </section>

        <section aria-labelledby="marge">
          <h2 id="marge" className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Marge potentielle
          </h2>
          <Card className="h-full">
            {margin ? (
              <>
                <p className={`figures text-xl font-bold ${margin.unitMarginXaf > 0 ? 'text-success' : 'text-danger'}`}>
                  <Money value={{ amountMinor: margin.unitMarginXaf, currency: 'XAF' }} /> par pièce (
                  {margin.marginPercent} %)
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ProvenanceBadge provenance="ESTIMATE" />
                </div>
                <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <li>
                    Prix de vente retenu :{' '}
                    <Money value={{ amountMinor: margin.unitSellingPriceXaf, currency: 'XAF' }} /> — la borne basse
                    de la fourchette relevée, par prudence.
                  </li>
                  <li>
                    Coût rendu retenu :{' '}
                    <Money value={{ amountMinor: margin.unitLandedCostXaf, currency: 'XAF' }} /> par pièce, à la
                    quantité minimum.
                  </li>
                  <li>
                    Prix relevé le {formatDate(margin.basedOnPriceObservedAt)} — {margin.basedOnPriceSource}.
                  </li>
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                La marge ne peut pas être estimée : elle demande un prix local relevé et daté.
              </p>
            )}
          </Card>
        </section>
      </div>

      {product.market && (
        <section aria-labelledby="marche">
          <h2 id="marche" className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Marché local
          </h2>
          <Card className="grid gap-2">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MarketFigure label="Demande" value={product.market.demandLabel} />
              <MarketFigure label="Concurrence" value={product.market.competitionLabel} />
              <MarketFigure label="Risque" value={product.market.riskLabel} />
              <MarketFigure label="Transport" value={product.market.transportEaseLabel} />
            </div>
            {product.market.capitalRequiredXaf !== null && (
              <Row label="Capital conseillé pour se lancer">
                <Money value={{ amountMinor: product.market.capitalRequiredXaf, currency: 'XAF' }} />
              </Row>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <ProvenanceBadge provenance={product.market.provenance} />
              <span className="text-xs text-muted-foreground">
                Apprécié le {formatDate(product.market.assessedAt)} — {product.market.source}
              </span>
            </div>
          </Card>
        </section>
      )}

      <section aria-labelledby="vigilance">
        <h2 id="vigilance" className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Points de vigilance
        </h2>
        <Card>
          {product.watchPoints.length > 0 ? (
            <ul className="grid gap-2 text-sm">
              {product.watchPoints.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun point de vigilance n’a encore été consigné. Cela ne signifie pas qu’il n’y a aucun risque :
              demandez un échantillon avant toute commande importante.
            </p>
          )}
        </Card>
      </section>

      <section aria-labelledby="fournisseurs">
        <h2 id="fournisseurs" className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Fournisseurs associés
        </h2>
        <Card>
          {product.supplierIds.length > 0 ? (
            <ul className="grid gap-2">
              {product.supplierIds.map((supplierId) => (
                <li key={supplierId}>
                  <Link
                    href={`/fournisseurs/${supplierId}`}
                    className="flex min-h-11 items-center gap-2 text-sm font-medium"
                  >
                    <Factory className="size-4" aria-hidden />
                    Voir la fiche du fournisseur
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun fournisseur n’est encore rattaché à ce produit. Nous ne publions un fournisseur qu’une fois
              son identité vérifiée.
            </p>
          )}
        </Card>
      </section>

      <InvestmentSimulator product={product} />
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:px-6 md:py-8">{children}</div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  );
}

function MarketFigure({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md bg-surface-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value ?? 'Non relevé'}</p>
    </div>
  );
}

/** Galerie : image principale et vignettes. Les visuels sont servis sans optimiseur. */
function Gallery({ product }: { product: CatalogProductDetail }) {
  const [active, setActive] = useState(0);
  const images = product.images;

  if (images.length === 0) {
    return (
      <div className="flex aspect-4/3 items-center justify-center rounded-lg border border-border bg-surface-muted text-muted-foreground">
        <span className="flex flex-col items-center gap-1 text-sm">
          <ImageOff className="size-6" aria-hidden />
          Aucune photo disponible
        </span>
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className="grid gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- source distante ou intégrée, sans optimiseur */}
      <img
        src={current.url}
        alt={current.alt}
        className="aspect-4/3 w-full rounded-lg border border-border bg-surface-muted object-cover"
      />
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Afficher l’image ${index + 1} sur ${images.length}`}
                aria-current={index === active ? 'true' : undefined}
                className={`size-16 overflow-hidden rounded-md border ${
                  index === active ? 'border-imperial' : 'border-border'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- vignette de la même source */}
                <img src={image.url} alt="" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <Wrapper>
      <Skeleton className="h-4 w-40" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="aspect-4/3 w-full rounded-lg" />
        <div className="grid content-start gap-3">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-56 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </Wrapper>
  );
}
