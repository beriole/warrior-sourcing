'use client';

import type { ResourceCard } from '@ws/contracts';
import { Badge, Button, Card } from '@ws/ui';
import { Download, FileText, Lock } from 'lucide-react';
import Link from 'next/link';
import { formatDate, formatFileSize, useResourceDownload } from './academy-client';

/**
 * Carte d'une ressource de la bibliothèque (ACA-05).
 *
 * Le bouton de téléchargement n'existe que si le serveur a dit que ce compte peut
 * télécharger. Sinon, la carte affiche la raison telle que le serveur l'a formulée :
 * l'interface ne masque pas un refus et n'en invente pas d'autre (§54).
 */
export function ResourceCardView({ resource }: { resource: ResourceCard }) {
  const download = useResourceDownload();
  const size = formatFileSize(resource.sizeBytes);

  function open() {
    download.mutate(resource.slug, {
      onSuccess: (result) => {
        // Le lien est signé et temporaire : on l'ouvre, on ne le conserve pas.
        window.open(result.url, '_blank', 'noopener,noreferrer');
      },
    });
  }

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
          {resource.downloadable ? <FileText className="size-5" aria-hidden /> : <Lock className="size-5" aria-hidden />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="night">{resource.typeLabel}</Badge>
            <Badge tone="neutral">{resource.themeLabel}</Badge>
            {!resource.free && <Badge tone="gold">Réservée aux inscrits</Badge>}
          </div>

          <h3 className="mt-2 font-semibold leading-tight">{resource.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{resource.description}</p>

          <p className="figures mt-2 text-xs text-muted-foreground">
            {resource.fileFormat.toUpperCase()}
            {resource.pageCount !== null && ` — ${resource.pageCount} page${resource.pageCount > 1 ? 's' : ''}`}
            {size !== null && ` — ${size}`}
            {' — publiée le '}
            {formatDate(resource.publishedAt)}
          </p>

          {resource.courseSlug && resource.courseTitle && (
            <p className="mt-1 text-xs text-muted-foreground">
              Fournie avec{' '}
              <Link href={`/academy/${resource.courseSlug}`} className="font-semibold underline">
                {resource.courseTitle}
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        {resource.downloadable ? (
          <>
            <Button size="sm" variant="outline" onClick={open} loading={download.isPending}>
              <Download aria-hidden />
              Télécharger
            </Button>
            {download.isError && (
              <p className="mt-2 text-xs text-danger">
                {download.error instanceof Error
                  ? download.error.message
                  : 'Le téléchargement n’a pas abouti. Réessayez dans un instant.'}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{resource.lockedReason}</p>
        )}
      </div>
    </Card>
  );
}
