'use client';

import { useQuery } from '@tanstack/react-query';
import { formatMoney, SHIPPING_MODE_LABELS, type TrackedOrderSummary } from '@ws/contracts';
import { Badge, Button, Card, GrilleAnimee, Progress, Skeleton } from '@ws/ui';
import { ArrowRight, Calculator, PackageSearch, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ApiError } from '@/lib/api-fetcher';
import { fetchOrders, formatDateTime } from './api';

/**
 * Mes importations (LOG-02) : chaque commande, son étape réelle et sa prochaine étape.
 * Aucune donnée n'est inventée : sans commande, l'écran dit pourquoi et propose une action.
 */
export function ImportationsView() {
  const router = useRouter();
  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['importations'],
    queryFn: fetchOrders,
    retry: false,
  });

  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) router.replace('/connexion');
  }, [isError, error, router]);

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Mes importations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque étape affichée a été enregistrée par un agent, avec sa date et, quand elle existe,
          sa preuve.
        </p>
      </header>

      {isPending && (
        <div className="grid gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="text-center">
          <h2 className="font-display text-lg font-bold">
            Vos importations n’ont pas pu être chargées
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Une erreur inattendue s'est produite."}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      )}

      {data && data.orders.length === 0 && (
        <Card className="flex flex-col items-start">
          <span className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
            <PackageSearch className="size-5" aria-hidden />
          </span>
          <h2 className="font-semibold">Aucune importation en cours</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Le suivi apparaît ici dès qu’une commande est payée. Partez d’un budget : le calculateur
            vous donne le coût rendu au Cameroun avant de vous engager.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-4">
            <Link href="/calculateur">
              <Calculator aria-hidden />
              Calculer ma rentabilité
            </Link>
          </Button>
        </Card>
      )}

      {data && data.orders.length > 0 && (
        <GrilleAnimee signature={`commandes-${data.orders.length}`} className="grid gap-3">
          {data.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </GrilleAnimee>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: TrackedOrderSummary }) {
  const delivered = order.stage === 'DELIVERED';
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="figures font-semibold">{order.reference}</span>
          {order.parcelCode && (
            <span
              className="figures ml-2 text-xs text-muted-foreground"
              title="Code de votre colis"
            >
              Colis {order.parcelCode}
            </span>
          )}
        </div>
        <Badge tone={delivered ? 'success' : 'night'}>{order.stageLabel}</Badge>
      </div>

      <Progress
        value={order.progress * 100}
        className="mt-3"
        aria-label={`Étape ${order.stageIndex + 1} sur ${order.stageCount}`}
      />

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Étape actuelle</dt>
          <dd className="font-semibold">{order.stageLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Prochaine étape</dt>
          <dd className="font-semibold text-muted-foreground">
            {order.nextStageLabel ?? 'Terminée'}
          </dd>
        </div>
      </dl>

      {order.lastEvent ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {order.lastEvent.description}{' '}
          <span className="figures">({formatDateTime(order.lastEvent.occurredAt)})</span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Aucun événement enregistré pour l’instant.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm">
          <span className="figures font-semibold">
            {formatMoney({ amountMinor: order.totalXaf, currency: 'XAF' })}
          </span>
          {order.shippingMode && (
            <span className="ml-2 text-muted-foreground">
              {SHIPPING_MODE_LABELS[order.shippingMode]}
            </span>
          )}
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href={`/importations/${encodeURIComponent(order.reference)}`}>
            Voir le suivi
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
