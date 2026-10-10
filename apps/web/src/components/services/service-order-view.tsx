'use client';

import {
  CHECKOUT_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type CheckoutPaymentMethod,
} from '@ws/contracts';
import { Badge, Button, Card, Money, Progress, Skeleton } from '@ws/ui';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { dateCourte, useCancelServiceOrder, useRetryServicePayment, useServiceOrder } from './services-client';

/**
 * Suivi d'une commande de prestation (SRV-02).
 *
 * Le suivi est celui que l'équipe a réellement écrit : chaque étape porte sa date et sa
 * note. Aucune étape n'est anticipée, et l'avancement affiché vient du serveur — c'est
 * lui qui sait où en est la prestation, pas l'écran.
 */
export function ServiceOrderView({ reference }: { reference: string }) {
  const { data, isPending, isError, error, refetch, isRefetching } = useServiceOrder(reference);
  const relancer = useRetryServicePayment(reference);
  const annuler = useCancelServiceOrder(reference);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('MTN_MOMO');

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6 md:px-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <Card className="text-center">
          <h1 className="font-display text-lg font-bold">Cette demande n’a pas pu être chargée</h1>
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

  const { order } = data;
  const ton =
    order.status === 'DELIVERED'
      ? 'success'
      : order.status === 'CANCELLED'
        ? 'neutral'
        : order.status === 'PENDING_PAYMENT'
          ? 'warning'
          : 'brand';

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Link
        href="/services/demandes"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mes demandes
      </Link>

      <header>
        <p className="figures text-xs text-muted-foreground">{order.reference}</p>
        <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight">{order.serviceName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={ton}>{order.statusLabel}</Badge>
          <Badge tone="neutral">{order.categoryLabel}</Badge>
          <span className="figures text-sm font-semibold">
            <Money value={{ amountMinor: order.amountXaf, currency: 'XAF' }} />
          </span>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{order.statusDescription}</p>
      </header>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Avancement</h2>
          <span className="figures text-sm text-muted-foreground">{order.progressPercent} %</span>
        </div>
        <Progress className="mt-2" value={order.progressPercent} />
        <p className="mt-2 text-xs text-muted-foreground">
          Délai annoncé à la commande : {order.leadTimeLabel}.
        </p>
      </Card>

      {order.status === 'PENDING_PAYMENT' && (
        <Card>
          <h2 className="text-base font-semibold">Le paiement n’est pas encore confirmé</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.payment?.instruction ??
              'Validez la demande de paiement reçue sur votre téléphone. La prestation démarre dès la confirmation.'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {CHECKOUT_PAYMENT_METHODS.map((methode) => (
              <button
                key={methode}
                type="button"
                onClick={() => setPaymentMethod(methode)}
                aria-pressed={paymentMethod === methode}
                className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
                  paymentMethod === methode
                    ? 'border-primary bg-imperial-soft'
                    : 'border-border bg-surface hover:bg-surface-muted'
                }`}
              >
                {PAYMENT_METHOD_LABELS[methode]}
              </button>
            ))}
          </div>

          {relancer.isError && (
            <p role="alert" className="mt-3 rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              {relancer.error instanceof Error ? relancer.error.message : 'La relance n’a pas abouti.'}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button loading={relancer.isPending} onClick={() => relancer.mutate({ paymentMethod })}>
              Relancer le paiement
            </Button>
            <Button variant="outline" loading={annuler.isPending} onClick={() => annuler.mutate()}>
              Annuler la demande
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-base font-semibold">Votre demande</h2>
        <p className="mt-2 text-sm whitespace-pre-wrap">{order.brief}</p>
        <dl className="mt-3 grid gap-1.5 text-sm">
          <Ligne label="Ville">{order.city}</Ligne>
          <Ligne label="Contact">
            <span className="figures">{order.contactPhone}</span>
          </Ligne>
          {order.quantity !== null && (
            <Ligne label="Quantité">
              <span className="figures">{order.quantity}</span>
            </Ligne>
          )}
          {order.budgetXaf !== null && (
            <Ligne label="Budget visé">
              <Money value={{ amountMinor: order.budgetXaf, currency: 'XAF' }} />
            </Ligne>
          )}
        </dl>

        {order.orderedDeliverables.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold">Ce qui vous a été annoncé</h3>
            <ul className="mt-1.5 list-inside list-disc text-sm text-muted-foreground">
              {order.orderedDeliverables.map((livrable) => (
                <li key={livrable}>{livrable}</li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Suivi</h2>
        <ol className="mt-3 grid gap-3">
          {order.events.map((event) => (
            <li key={event.id} className="grid gap-0.5 border-l-2 border-border pl-3">
              <p className="text-sm font-semibold">{event.statusLabel}</p>
              {event.note && <p className="text-sm text-muted-foreground">{event.note}</p>}
              <p className="figures text-xs text-muted-foreground">{dateCourte(event.createdAt)}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Livrables</h2>
        {order.deliverables.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {order.paidAt === null
              ? 'Les livrables apparaîtront ici une fois le paiement confirmé et la prestation exécutée.'
              : 'Rien n’a encore été déposé. Vous serez prévenu dès qu’un livrable est disponible.'}
          </p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {order.deliverables.map((livrable) => (
              <li
                key={livrable.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <span>
                  <span className="text-sm font-medium">{livrable.title}</span>
                  <span className="figures ml-2 text-xs text-muted-foreground">
                    {livrable.fileFormat.toUpperCase()} — {dateCourte(livrable.createdAt)}
                  </span>
                  {livrable.note && (
                    <span className="block text-xs text-muted-foreground">{livrable.note}</span>
                  )}
                </span>
                <Button variant="outline" size="sm" asChild>
                  <a href={livrable.url} target="_blank" rel="noreferrer">
                    <Download aria-hidden />
                    Télécharger
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
