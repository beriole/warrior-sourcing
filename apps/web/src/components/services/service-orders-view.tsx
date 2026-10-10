'use client';

import { Badge, Button, Card, GrilleAnimee, Money, Progress, Skeleton } from '@ws/ui';
import { ArrowRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { dateCourte, useServiceOrders } from './services-client';

/** Mes demandes de prestation (SRV-02) : état réel, avancement calculé par le serveur. */
export function ServiceOrdersView() {
  const { data, isPending, isError, error, refetch, isRefetching } = useServiceOrders();

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Mes demandes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les prestations que vous nous avez confiées, avec leur avancement réel.
        </p>
      </header>

      {isPending ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Card className="text-center">
          <h2 className="font-display text-lg font-bold">Vos demandes n’ont pas pu être chargées</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.'}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      ) : data.items.length === 0 ? (
        <Card>
          <h2 className="font-semibold">Aucune demande pour l’instant</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Les prestations de l’équipe — recherche de fournisseur, inspection, transport — se commandent
            depuis le catalogue.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/services">
              Voir les prestations
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </Card>
      ) : (
        <GrilleAnimee signature={`demandes-${data.items.length}`} className="grid gap-3">
          {data.items.map((demande) => (
            <Card key={demande.reference} className="p-0">
              <Link
                href={`/services/demandes/${demande.reference}`}
                className="grid gap-2 rounded-lg p-4 focus-visible:ring-2 focus-visible:ring-imperial focus-visible:outline-none"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{demande.serviceName}</span>
                  <Badge
                    tone={
                      demande.status === 'DELIVERED'
                        ? 'success'
                        : demande.status === 'CANCELLED'
                          ? 'neutral'
                          : demande.status === 'PENDING_PAYMENT'
                            ? 'warning'
                            : 'brand'
                    }
                  >
                    {demande.statusLabel}
                  </Badge>
                </div>
                <Progress value={demande.progressPercent} />
                <p className="figures text-xs text-muted-foreground">
                  {demande.reference} · <Money value={{ amountMinor: demande.amountXaf, currency: 'XAF' }} />{' '}
                  · demandée le {dateCourte(demande.createdAt)}
                  {demande.deliverableCount > 0 &&
                    ` · ${demande.deliverableCount} livrable${demande.deliverableCount > 1 ? 's' : ''}`}
                </p>
              </Link>
            </Card>
          ))}
        </GrilleAnimee>
      )}
    </div>
  );
}
