'use client';

import { useQuery } from '@tanstack/react-query';
import {
  formatMoney,
  SHIPPING_MODE_LABELS,
  type InspectionReportResponse,
  type InspectionResult,
  type ShipmentEventResponse,
  type TrackedOrderDetailResponse,
} from '@ws/contracts';
import { Badge, Button, Card, Skeleton } from '@ws/ui';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ImageIcon,
  RefreshCw,
  Undo2,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ApiError } from '@/lib/api-fetcher';
import { fetchOrder, formatDateTime, isImageUrl } from './api';
import { ShipmentRoute } from './shipment-route';

const RESULT_TONES: Record<InspectionResult, 'success' | 'warning' | 'danger'> = {
  COMPLIANT: 'success',
  WITH_RESERVATIONS: 'warning',
  NON_COMPLIANT: 'danger',
};

/**
 * Suivi détaillé d'une commande (LOG-02, LOG-05) : carte stylisée, étape actuelle et suivante,
 * timeline des événements réels avec leurs preuves, rapports d'inspection archivés.
 */
export function ImportationDetailView({ reference }: { reference: string }) {
  const router = useRouter();
  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['importation', reference],
    queryFn: () => fetchOrder(reference),
    retry: false,
  });

  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) router.replace('/connexion');
  }, [isError, error, router]);

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Link
        href="/importations"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mes importations
      </Link>

      {isPending && (
        <div className="grid gap-4">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      )}

      {isError && (
        <Card className="text-center">
          <h1 className="font-display text-lg font-bold">
            {error instanceof ApiError && error.status === 404
              ? 'Cette commande est introuvable'
              : 'Le suivi n’a pas pu être chargé'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Une erreur inattendue s'est produite."}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      )}

      {data && <Detail data={data} />}
    </div>
  );
}

function Detail({ data }: { data: TrackedOrderDetailResponse }) {
  const { order, parcel, events, inspections } = data;
  const delivered = order.stage === 'DELIVERED';

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Commande
          </p>
          <h1 className="figures font-display text-2xl font-bold tracking-tight">
            {order.reference}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {parcel ? (
              <>
                Code colis{' '}
                <span className="figures font-semibold text-foreground">{parcel.code}</span>
              </>
            ) : (
              'Code colis attribué à l’enregistrement du colis.'
            )}
            {order.shippingMode && <> · {SHIPPING_MODE_LABELS[order.shippingMode]}</>}
            {' · '}
            <span className="figures">
              {formatMoney({ amountMinor: order.totalXaf, currency: 'XAF' })}
            </span>
          </p>
        </div>
        <Badge tone={delivered ? 'success' : 'night'}>{order.stageLabel}</Badge>
      </header>

      <Card>
        <ShipmentRoute stage={order.stage} />
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Étape actuelle</dt>
            <dd className="font-semibold">
              {order.stageLabel}{' '}
              <span className="figures text-xs font-normal text-muted-foreground">
                ({order.stageIndex + 1}/{order.stageCount})
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Prochaine étape</dt>
            <dd className="font-semibold text-muted-foreground">
              {order.nextStageLabel ?? 'Commande terminée'}
            </dd>
          </div>
        </dl>
      </Card>

      {inspections.length > 0 && (
        <section aria-labelledby="inspections">
          <h2
            id="inspections"
            className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Rapports d’inspection
          </h2>
          <div className="grid gap-3">
            {inspections.map((report) => (
              <InspectionCard key={report.id} report={report} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="historique">
        <h2
          id="historique"
          className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Historique
        </h2>
        {events.length === 0 ? (
          <Card>
            <p className="text-sm text-muted-foreground">
              Aucun événement enregistré pour l’instant. Votre commande est à l’étape «{' '}
              {order.stageLabel} » ; le prochain enregistrement d’un agent apparaîtra ici avec sa
              date.
            </p>
          </Card>
        ) : (
          <Card>
            <ol className="grid gap-0">
              {events.map((event, index) => (
                <EventItem key={event.id} event={event} last={index === events.length - 1} />
              ))}
            </ol>
          </Card>
        )}
      </section>
    </>
  );
}

function EventItem({ event, last }: { event: ShipmentEventResponse; last: boolean }) {
  const rollback = event.rollbackReason !== null;
  const proofs = [event.proofUrl, ...event.proofUrls].filter((url): url is string => Boolean(url));

  return (
    <li className="relative grid grid-cols-[20px_1fr] gap-3 pb-5 last:pb-0">
      {!last && (
        <span
          className="absolute top-5 left-[9px] h-[calc(100%-8px)] w-0.5 bg-border"
          aria-hidden
        />
      )}
      <span
        className={`relative mt-0.5 inline-flex size-5 items-center justify-center rounded-full ${
          rollback ? 'bg-warning-soft text-warning' : 'bg-gold-soft text-gold-ink'
        }`}
        aria-hidden
      >
        {rollback ? <Undo2 className="size-3" /> : <CheckCircle2 className="size-3.5" />}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">{event.stageLabel}</span>
          <span className="figures text-xs text-muted-foreground">
            {formatDateTime(event.occurredAt)}
          </span>
          {rollback && <Badge tone="warning">Retour en arrière</Badge>}
        </div>
        <p className="mt-1 text-sm">{event.description}</p>
        {rollback && (
          <p className="mt-1 text-xs text-muted-foreground">Motif : {event.rollbackReason}</p>
        )}
        {proofs.length > 0 && <ProofList urls={proofs} />}
      </div>
    </li>
  );
}

/** Photos et documents joints à un événement ou à un rapport : uniquement ceux qui existent. */
function ProofList({ urls }: { urls: string[] }) {
  const images = urls.filter(isImageUrl);
  const documents = urls.filter((url) => !isImageUrl(url));
  return (
    <div className="mt-2 grid gap-2">
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-md border border-border"
              >
                {/* Photo déposée par un agent : hébergée ailleurs, dimension inconnue, on ne l'optimise pas. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Preuve photographique"
                  className="size-20 object-cover"
                  loading="lazy"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
      {documents.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {documents.map((url, index) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium"
              >
                {/\.(mp4|mov|webm)(\?.*)?$/i.test(url) || /\/video\/upload\//.test(url) ? (
                  <Video className="size-4" aria-hidden />
                ) : (
                  <FileText className="size-4" aria-hidden />
                )}
                Document {index + 1}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InspectionCard({ report }: { report: InspectionReportResponse }) {
  const rows: { label: string; value: string | null }[] = [
    {
      label: 'Quantité',
      value:
        report.quantityReceived !== null || report.quantityExpected !== null
          ? `${report.quantityReceived ?? '—'} reçu(s) / ${report.quantityExpected ?? '—'} attendu(s)`
          : null,
    },
    { label: 'Défauts', value: report.defects },
    { label: 'Emballage', value: report.packaging },
    { label: 'Mesures', value: report.measurements },
    {
      label: 'Poids',
      value:
        report.weightGrams !== null
          ? `${(report.weightGrams / 1000).toLocaleString('fr-FR')} kg`
          : null,
    },
    { label: 'Remarques', value: report.notes },
  ];
  const proofs = [...report.photoUrls, ...(report.videoUrl ? [report.videoUrl] : [])];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 font-semibold">
          <ClipboardCheck className="size-4 text-muted-foreground" aria-hidden />
          Inspection du <span className="figures">{formatDateTime(report.inspectedAt)}</span>
        </span>
        <Badge tone={RESULT_TONES[report.result]}>{report.resultLabel}</Badge>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {rows
          .filter(
            (row): row is { label: string; value: string } =>
              row.value !== null && row.value !== '',
          )
          .map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
      </dl>
      {proofs.length > 0 ? (
        <ProofList urls={proofs} />
      ) : (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImageIcon className="size-3.5" aria-hidden />
          Aucune photo jointe à ce rapport.
        </p>
      )}
      {report.inspectedByName && (
        <p className="mt-3 text-xs text-muted-foreground">
          Rapport établi par {report.inspectedByName}.
        </p>
      )}
    </Card>
  );
}
