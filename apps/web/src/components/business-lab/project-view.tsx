'use client';

import { Badge, Button, Card, Money, MontantAnime, Progress, Skeleton } from '@ws/ui';
import { AlertTriangle, ArrowLeft, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  aujourdhui,
  dateCourte,
  enInstant,
  useAddSale,
  useBusinessProject,
  useRemoveSale,
} from './business-lab-client';

const xaf = (amountMinor: number) => ({ amountMinor, currency: 'XAF' as const });

/**
 * Un projet commercial et ses ventes (§27).
 *
 * La saisie est volontairement minimale : quantité, prix obtenu, date. Plus un formulaire
 * demande de champs, moins les ventes sont saisies — et un Business Lab sans ventes
 * saisies ne mesure rien.
 */
export function ProjectView({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch, isRefetching } = useBusinessProject(id);
  const ajouter = useAddSale(id);
  const retirer = useRemoveSale(id);

  const [quantity, setQuantity] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);
  const [soldAt, setSoldAt] = useState(aujourdhui());

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6 md:px-6">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-36 w-full rounded-lg" />
        <Skeleton className="h-52 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <Card className="text-center">
          <h1 className="font-display text-lg font-bold">Ce projet n’a pas pu être chargé</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.'}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      </div>
    );
  }

  const { project } = data;
  const { metrics } = project;
  const saisieValide = quantity > 0 && unitPrice >= 0 && soldAt.length > 0;

  async function enregistrerVente() {
    await ajouter.mutateAsync({
      quantity,
      unitPriceXaf: unitPrice,
      soldAt: enInstant(soldAt),
      note: null,
    });
    setQuantity(0);
    setUnitPrice(0);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Link
        href="/business-lab"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Business Lab
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">{project.name}</h1>
          {metrics.capitalRecovered && <Badge tone="success">Capital récupéré</Badge>}
          {metrics.oversold && <Badge tone="warning">Saisie à vérifier</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Démarré le {dateCourte(project.startedAt)}
          {project.orderReference && ` · importation ${project.orderReference}`}
        </p>
      </header>

      <Card className="grid gap-3">
        <p className="flex items-start gap-2 text-sm">
          {metrics.oversold && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />}
          {project.progressLabel}
        </p>

        <div>
          <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <span>Capital récupéré</span>
            <span className="figures">
              {metrics.capitalRecoveredPercent} % — reste <Money value={xaf(metrics.capitalRemainingXaf)} />
            </span>
          </div>
          <Progress className="mt-1" value={metrics.capitalRecoveredPercent} />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <Chiffre label="Capital engagé" valeur={<Money value={xaf(project.capitalXaf)} />} />
          <Chiffre label="Encaissé" valeur={<MontantAnime value={xaf(metrics.revenueXaf)} />} />
          <Chiffre
            label="Marge constatée"
            valeur={<MontantAnime value={xaf(metrics.marginXaf)} />}
            negatif={metrics.marginXaf < 0}
          />
          <Chiffre label="ROI" valeur={`${metrics.roiPercent} %`} negatif={metrics.roiPercent < 0} />
          <Chiffre label="Coût de revient" valeur={<Money value={xaf(metrics.unitCostXaf)} />} />
          <Chiffre
            label="Prix moyen obtenu"
            valeur={
              metrics.averageUnitPriceXaf === null ? (
                <span className="text-xs font-normal text-muted-foreground">Aucune vente</span>
              ) : (
                <Money value={xaf(metrics.averageUnitPriceXaf)} />
              )
            }
          />
          <Chiffre label="Vendues" valeur={`${metrics.soldQuantity} / ${project.quantity}`} />
          <Chiffre label="Reste à vendre" valeur={String(metrics.remainingQuantity)} />
        </dl>
      </Card>

      <Card className="grid gap-3">
        <div>
          <h2 className="text-base font-semibold">Saisir une vente</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Le prix obtenu, pas le prix visé : c’est l’écart entre les deux qui fait la vraie marge.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <ChampNombre label="Unités vendues" value={quantity} onChange={setQuantity} />
          <ChampNombre label="Prix obtenu (FCFA)" value={unitPrice} onChange={setUnitPrice} />
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Date</span>
            <input
              type="date"
              value={soldAt}
              onChange={(event) => setSoldAt(event.target.value)}
              className="h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
            />
          </label>
        </div>

        {ajouter.isError && (
          <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
            {ajouter.error instanceof Error ? ajouter.error.message : 'La vente n’a pas pu être enregistrée.'}
          </p>
        )}

        <div>
          <Button loading={ajouter.isPending} disabled={!saisieValide} onClick={() => void enregistrerVente()}>
            <Plus aria-hidden />
            Enregistrer la vente
          </Button>
        </div>
      </Card>

      <Card className="grid gap-3">
        <h2 className="text-base font-semibold">Ventes saisies</h2>
        {project.sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune vente pour l’instant. Les indicateurs ci-dessus resteront à zéro jusqu’à la première.
          </p>
        ) : (
          <ul className="grid gap-2">
            {project.sales.map((vente) => (
              <li
                key={vente.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
              >
                <span>
                  <span className="figures font-semibold">
                    {vente.quantity} × <Money value={xaf(vente.unitPriceXaf)} />
                  </span>
                  <span className="figures ml-2 text-xs text-muted-foreground">
                    {dateCourte(vente.soldAt)} · total <Money value={xaf(vente.totalXaf)} />
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  loading={retirer.isPending}
                  onClick={() => retirer.mutate(vente.id)}
                >
                  <Trash2 aria-hidden />
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Chiffre({
  label,
  valeur,
  negatif = false,
}: {
  label: string;
  valeur: React.ReactNode;
  negatif?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`figures font-semibold ${negatif ? 'text-danger' : ''}`}>{valeur}</dd>
    </div>
  );
}

function ChampNombre({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={Number.isFinite(value) && value !== 0 ? value : ''}
        onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))}
        className="figures h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
      />
    </label>
  );
}
