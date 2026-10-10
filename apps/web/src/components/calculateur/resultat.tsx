'use client';

import {
  FREIGHT_UNIT_LABELS,
  SHIPPING_MODE_LABELS,
  type ImportCalculationResult,
} from '@ws/contracts';
import { Badge, Card, Compteur, Money, MontantAnime, ProvenanceBadge, useVientDeChanger } from '@ws/ui';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

/** Montant en FCFA, toujours affiché avec sa devise. */
function montant(amountMinor: number) {
  return { amountMinor, currency: 'XAF' as const };
}

function dateCourte(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Total toujours visible, même sur un écran de 360 px : la barre reste collée en haut
 * pendant que l'on remplit le formulaire (CALC-04).
 */
export function TotalColle({ result }: { result: ImportCalculationResult | null }) {
  // Le total est le seul héros de cet écran : lui seul bouge, et seulement
  // quand l'utilisateur vient de changer une valeur.
  const vientDeChanger = useVientDeChanger(result?.costs.total ?? null);

  return (
    <div
      className={`sticky top-0 z-10 -mx-4 border-b px-4 py-3 backdrop-blur transition-colors duration-500 md:-mx-6 md:px-6 ${
        vientDeChanger ? 'border-primary/40 bg-imperial-soft/80' : 'border-border bg-surface/95'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Coût total estimé
          </p>
          <p className="font-display text-2xl leading-tight font-bold">
            {result ? <MontantAnime value={montant(result.costs.total)} /> : '—'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Coût rendu par unité</p>
          <p className="figures text-base font-semibold">
            {result ? <MontantAnime value={montant(result.unitLandedCost)} /> : '—'}
          </p>
        </div>
      </div>
      {result && (
        <p className="mt-1 text-xs text-muted-foreground">
          {SHIPPING_MODE_LABELS[result.mode]} · {result.quantity} unité
          {result.quantity > 1 ? 's' : ''} · {delaiTexte(result)}
        </p>
      )}
    </div>
  );
}

function delaiTexte(result: ImportCalculationResult): string {
  if (result.freight.transitDays) return `${result.freight.transitDays} jours annoncés`;
  if (result.freight.transitDaysRange) {
    return `${result.freight.transitDaysRange.min} à ${result.freight.transitDaysRange.max} jours (estimation)`;
  }
  return 'délai non renseigné';
}

/** D'où vient le montant du fret : grille saisie datée, saisie manuelle, ou fourchette. */
export function OrigineDuFret({ result }: { result: ImportCalculationResult }) {
  const { freight } = result;

  return (
    <div className="rounded-md border border-border bg-surface-muted p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <ProvenanceBadge provenance={freight.provenance} />
        {freight.forwarderName && <Badge tone="brand">{freight.forwarderName}</Badge>}
        {freight.minimumApplied && <Badge tone="warning">Minimum facturé appliqué</Badge>}
      </div>
      <p className="mt-2 text-muted-foreground">
        {freight.origin === 'TARIFF' && freight.effectiveFrom && (
          <>
            Tarif appliqué : <Money value={montant(Math.round(freight.amountXaf))} /> pour{' '}
            {freight.chargeableQuantity} {freight.unit === 'KG' ? 'kg facturables' : 'm³'}, en vigueur
            depuis le {dateCourte(freight.effectiveFrom)}. Source : {freight.source}.
          </>
        )}
        {freight.origin === 'MANUAL' && <>Fret saisi par vous, à confirmer auprès de votre transitaire.</>}
        {freight.origin === 'FALLBACK' && freight.range && (
          <>
            Aucun transitaire choisi : nous retenons le haut d’une fourchette de{' '}
            <Money value={montant(freight.range.lowXaf)} /> à <Money value={montant(freight.range.highXaf)} />{' '}
            ({FREIGHT_UNIT_LABELS[freight.unit]}). {freight.source}.
          </>
        )}
      </p>
    </div>
  );
}

const POSTES: { cle: keyof ImportCalculationResult['costs']; label: string }[] = [
  { cle: 'merchandise', label: 'Marchandise' },
  { cle: 'chinaInlandTransport', label: 'Transport interne en Chine' },
  { cle: 'inspection', label: 'Inspection' },
  { cle: 'packaging', label: 'Packaging' },
  { cle: 'insurance', label: 'Assurance' },
  { cle: 'freight', label: 'Fret international' },
  { cle: 'serviceFee', label: 'Frais de service' },
  { cle: 'customsDuty', label: 'Droits de douane (estimation)' },
  { cle: 'vat', label: 'TVA (estimation)' },
  { cle: 'otherCosts', label: 'Coûts personnalisés' },
];

export function DetailDesPostes({ result }: { result: ImportCalculationResult }) {
  return (
    <Card>
      <h3 className="text-base font-semibold">Détail des coûts</h3>
      <dl className="mt-3 grid gap-1.5">
        {POSTES.filter(({ cle }) => result.costs[cle] > 0).map(({ cle, label }) => (
          <div key={cle} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">
              <Money value={montant(result.costs[cle])} />
            </dd>
          </div>
        ))}
        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-2 text-sm font-semibold">
          <dt>Total</dt>
          <dd>
            <Money value={montant(result.costs.total)} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">Coût rendu par unité</dt>
          <dd className="font-semibold">
            <Money value={montant(result.unitLandedCost)} />
          </dd>
        </div>
      </dl>

      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Poids facturable retenu : {result.measures.chargeableWeightKg} kg (réel{' '}
        {result.measures.realWeightKg} kg, volumétrique {result.measures.volumetricWeightKg} kg) pour{' '}
        {result.measures.volumeM3} m³.
      </p>
    </Card>
  );
}

export function Rentabilite({ result }: { result: ImportCalculationResult }) {
  if (!result.selling) return null;
  const { selling } = result;

  return (
    <Card>
      <h3 className="text-base font-semibold">Si vous revendez à ce prix</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Chiffre label="Chiffre d’affaires" valeur={<MontantAnime value={montant(selling.revenue)} />} />
        <Chiffre
          label="Marge totale"
          valeur={<MontantAnime value={montant(selling.totalMargin)} />}
          negatif={selling.totalMargin < 0}
        />
        <Chiffre label="Marge par unité" valeur={<MontantAnime value={montant(selling.unitMargin)} />} />
        <Chiffre
          label="Retour sur investissement"
          valeur={<Compteur valeur={selling.roi * 100} format={(v) => `${Math.round(v)} %`} />}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {selling.breakEvenUnits === null
          ? 'À ce prix de vente, l’opération ne rembourse jamais son coût.'
          : `Vous récupérez votre investissement après ${selling.breakEvenUnits} unités vendues.`}
      </p>
    </Card>
  );
}

function Chiffre({
  label,
  valeur,
  negatif = false,
}: {
  label: string;
  valeur: ReactNode;
  negatif?: boolean;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`figures mt-0.5 text-base font-semibold ${negatif ? 'text-danger' : ''}`}>{valeur}</p>
    </div>
  );
}

/** Comparaison côte à côte des modes de transport (CALC-04), lisible sur 360 px. */
export function Comparaison({
  comparison,
  modeChoisi,
  onChoisir,
}: {
  comparison: ImportCalculationResult[];
  modeChoisi: string;
  onChoisir: (mode: ImportCalculationResult['mode']) => void;
}) {
  const moinsCher = comparison.reduce((best, item) => (item.costs.total < best.costs.total ? item : best));

  return (
    <Card>
      <h3 className="text-base font-semibold">Comparer les modes de transport</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Même marchandise, même quantité : seul le transport change.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
        {comparison.map((item) => (
          <button
            key={item.mode}
            type="button"
            onClick={() => onChoisir(item.mode)}
            aria-pressed={item.mode === modeChoisi}
            className={`rounded-md border p-3 text-left transition-colors ${
              item.mode === modeChoisi
                ? 'border-primary bg-imperial-soft'
                : 'border-border hover:bg-surface-muted'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">{SHIPPING_MODE_LABELS[item.mode]}</span>
              {item.mode === moinsCher.mode && <Badge tone="success">Le moins cher</Badge>}
            </span>
            <span className="figures mt-1 block text-sm font-bold">
              <Money value={montant(item.costs.total)} />
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Fret <Money value={montant(item.costs.freight)} />
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{delaiTexte(item)}</span>
            <span className="mt-1.5 block">
              <ProvenanceBadge provenance={item.freight.provenance} />
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
