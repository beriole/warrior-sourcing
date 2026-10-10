'use client';

import { computeLandedCost } from '@ws/contracts';
import { Button, Card, Compteur, MontantAnime, ProvenanceBadge } from '@ws/ui';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useId, useState } from 'react';

const INITIAL = { quantity: 100, unitPrice: 1_800, freight: 60_000, sellingPrice: 3_500 };
type Field = keyof typeof INITIAL;

const xaf = (amountMinor: number) => ({ amountMinor, currency: 'XAF' as const });

/**
 * Simulateur express de la page publique (§14, §21).
 * Le calcul est celui de @ws/contracts, identique à celui de l'API.
 */
export function QuickSimulator() {
  const t = useTranslations('simulator');
  const [values, setValues] = useState(INITIAL);

  const result = computeLandedCost({
    quantity: Math.max(1, values.quantity),
    unitPurchasePrice: values.unitPrice,
    freight: values.freight,
    unitSellingPrice: values.sellingPrice,
  });
  const selling = result.selling;

  return (
    <Card className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
      {/*
        Une seule colonne sous 360 px : à deux colonnes, les champs de montant
        débordaient de l'écran sur un téléphone d'entrée de gamme, et la page
        défilait latéralement. C'est exactement le matériel de nos utilisateurs.
      */}
      <div className="grid min-w-0 grid-cols-1 gap-3 self-start min-[360px]:grid-cols-2">
        <NumberField label={t('quantity')} field="quantity" values={values} onChange={setValues} />
        <NumberField label={t('unitPrice')} field="unitPrice" values={values} onChange={setValues} />
        <NumberField label={t('freight')} field="freight" values={values} onChange={setValues} />
        <NumberField label={t('sellingPrice')} field="sellingPrice" values={values} onChange={setValues} />
      </div>

      <div className="min-w-0 rounded-md bg-night p-4 text-white" aria-live="polite">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm text-white/70">{t('totalCost')}</span>
          <ProvenanceBadge provenance="ESTIMATE" />
        </div>
        <MontantAnime value={xaf(result.totalCost)} className="block font-display text-3xl font-bold" />

        <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 text-sm min-[360px]:grid-cols-2">
          <Stat label={t('unitLandedCost')}>
            <MontantAnime value={xaf(result.unitLandedCost)} />
          </Stat>
          <Stat label={t('unitMargin')}>
            {selling && (
              <MontantAnime
                value={xaf(selling.unitMargin)}
                className={selling.unitMargin < 0 ? 'text-red-300' : 'text-gold'}
              />
            )}
          </Stat>
          <Stat label={t('roi')}>
            {selling ? (
              <Compteur
                valeur={selling.roi * 100}
                format={(v) => `${Math.round(v)} %`}
              />
            ) : (
              <span className="figures">—</span>
            )}
          </Stat>
          <Stat label={t('breakEven')}>
            {selling?.breakEvenUnits != null ? (
              <span className="figures">{t('breakEvenValue', { count: selling.breakEvenUnits })}</span>
            ) : (
              <span className="text-red-300">{t('breakEvenNever')}</span>
            )}
          </Stat>
        </dl>

        <p className="mt-4 text-xs text-white/60">{t('disclaimer')}</p>
        {/* Le calculateur complet reprend ces hypothèses en détail : transport, douane,
            assurance, comparaison des modes. */}
        <Button asChild variant="gold" block className="mt-4">
          <Link href="/calculateur">
            {t('cta')}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function NumberField({
  label,
  field,
  values,
  onChange,
}: {
  label: string;
  field: Field;
  values: typeof INITIAL;
  onChange: (next: typeof INITIAL) => void;
}) {
  const id = useId();
  return (
    // `min-w-0` : un élément de grille refuse par défaut de descendre sous la largeur
    // intrinsèque de son contenu, et un `<input type="number">` en réclame une
    // vingtaine de caractères. Sans cela, la colonne pousse la page au-delà de
    // l'écran sur un téléphone étroit, quelle que soit la largeur demandée au champ.
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={field === 'quantity' ? 1 : 0}
        value={values[field]}
        onChange={(event) => onChange({ ...values, [field]: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
        className="figures h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-base font-semibold outline-none focus-visible:border-primary"
      />
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-white/60">{label}</dt>
      <dd className="mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}
