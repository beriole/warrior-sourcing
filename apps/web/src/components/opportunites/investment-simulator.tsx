'use client';

import type { CatalogProductDetail } from '@ws/contracts';
import { Button, Card, Money, MontantAnime, ProvenanceBadge } from '@ws/ui';
import { AlertTriangle, Calculator } from 'lucide-react';
import { useState } from 'react';
import { formatDate, useInvestmentSimulation } from './catalog-client';

/**
 * Simulateur d'investissement (§14).
 *
 * Un budget saisi donne une quantité, un investissement, un coût rendu unitaire, un
 * chiffre d'affaires potentiel, une marge, un retour sur investissement et un seuil de
 * rentabilité. Tout le bloc est marqué « estimation » : ce n'est ni un devis ni une promesse.
 */
export function InvestmentSimulator({ product }: { product: CatalogProductDetail }) {
  const [budget, setBudget] = useState('');
  const simulation = useInvestmentSimulation(product.slug);
  const result = simulation.data;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(budget);
    if (!Number.isFinite(value) || value <= 0) return;
    simulation.mutate(Math.round(value));
  }

  return (
    <Card id="simulateur" className="scroll-mt-20">
      <h2 className="font-display text-lg font-bold">Simuler mon investissement</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Indiquez ce que vous pouvez investir aujourd’hui. Nous calculons la quantité correspondante et ce
        qu’elle peut rapporter au prix local relevé.
      </p>

      <form onSubmit={submit} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Votre budget (FCFA)</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            placeholder="Par exemple 250000"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-imperial"
          />
        </label>
        <Button type="submit" className="self-end" loading={simulation.isPending}>
          <Calculator aria-hidden />
          Calculer
        </Button>
      </form>

      {simulation.isError && (
        <p className="mt-3 text-sm text-danger">
          {simulation.error instanceof Error
            ? simulation.error.message
            : 'La simulation n’a pas abouti. Réessayez dans un instant.'}
        </p>
      )}

      {result && (
        <div className="mt-5 grid gap-4">
          {result.belowMinimumOrder && (
            <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Votre budget ne couvre pas encore la commande minimum de {product.moq} pièces. Les chiffres
              ci-dessous correspondent à cette quantité minimum.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Figure label="Quantité" value={`${result.quantity} pièces`} />
            <Figure
              label="Investissement total"
              value={<MontantAnime value={{ amountMinor: result.totalInvestmentXaf, currency: 'XAF' }} />}
            />
            <Figure
              label="Coût rendu unitaire"
              value={<MontantAnime value={{ amountMinor: result.unitLandedCostXaf, currency: 'XAF' }} />}
            />
            {result.sale ? (
              <>
                <Figure
                  label="Chiffre d’affaires potentiel"
                  value={<MontantAnime value={{ amountMinor: result.sale.potentialRevenueXaf, currency: 'XAF' }} />}
                />
                <Figure
                  label="Marge potentielle"
                  value={<MontantAnime value={{ amountMinor: result.sale.totalMarginXaf, currency: 'XAF' }} />}
                  accent={result.sale.totalMarginXaf > 0}
                />
                <Figure label="Retour sur investissement" value={`${result.sale.roiPercent} %`} />
                <Figure
                  label="Seuil de rentabilité"
                  value={
                    result.sale.breakEvenUnits === null
                      ? 'Jamais atteint à ce prix'
                      : `${result.sale.breakEvenUnits} pièces vendues`
                  }
                />
                <Figure
                  label="Budget non utilisé"
                  value={<MontantAnime value={{ amountMinor: result.remainingBudgetXaf, currency: 'XAF' }} />}
                />
              </>
            ) : null}
          </div>

          {result.sale ? (
            <p className="text-xs text-muted-foreground">
              Prix de vente retenu :{' '}
              <Money value={{ amountMinor: result.sale.unitSellingPriceXaf, currency: 'XAF' }} /> — borne basse
              de la fourchette relevée le {formatDate(result.sale.basedOnPriceObservedAt)} (
              {result.sale.basedOnPriceSource}).
            </p>
          ) : (
            <p className="rounded-md bg-surface-muted p-3 text-sm text-muted-foreground">
              {result.saleUnavailableReason}
            </p>
          )}

          <div className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <ProvenanceBadge provenance="ESTIMATE" />
              <span className="text-xs font-semibold">Hypothèses du calcul</span>
            </div>
            <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
              {result.assumptions.map((assumption) => (
                <li key={assumption.label}>
                  <span className="font-medium text-foreground">{assumption.label}</span> : {assumption.detail} —{' '}
                  {assumption.source}, relevé le {formatDate(assumption.observedAt)}.
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{result.warning}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function Figure({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md bg-surface-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`figures mt-1 text-base font-bold ${accent ? 'text-success' : ''}`}>{value}</p>
    </div>
  );
}
