'use client';

import {
  UPLOAD_MAX_BYTES,
  uploadAcceptAttribute,
  uploadKindForContentType,
  type SignUploadRequest,
  type SignUploadResponse,
  type UploadFolder,
  type UploadKind,
  type UploadedAsset,
} from '@ws/contracts';
import { Button, Progress, cn } from '@ws/ui';
import { CheckCircle2, FileUp, RotateCcw, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { ApiError, apiRequest } from '@/lib/api-fetcher';

type UploadState =
  | { step: 'idle' }
  | { step: 'signing'; fileName: string }
  | { step: 'uploading'; fileName: string; percent: number }
  | { step: 'done'; fileName: string; asset: UploadedAsset }
  | { step: 'error'; fileName: string | null; message: string };

export type UploadFieldProps = {
  /** Dossier Cloudinary de destination (liste fermée dans @ws/contracts). */
  folder: UploadFolder;
  /** Familles acceptées ; par défaut images, PDF et vidéos MP4. */
  kinds?: readonly UploadKind[];
  label?: string;
  /** Explication sous le champ (formats, usage). */
  hint?: string;
  disabled?: boolean;
  className?: string;
  /** Appelé avec l'URL et l'identifiant retournés par Cloudinary une fois l'envoi terminé. */
  onUploaded: (asset: UploadedAsset) => void;
};

const KIND_LABELS: Record<UploadKind, string> = {
  IMAGE: 'image JPEG, PNG ou WebP',
  DOCUMENT: 'PDF',
  VIDEO: 'vidéo MP4',
};

const GENERIC_ERROR = 'L’envoi n’a pas abouti. Vérifiez votre connexion, puis réessayez.';

/**
 * Champ d'envoi de fichier (PLAT-06).
 *
 * 1. Le serveur vérifie le type et la taille, puis signe l'envoi (`POST /v1/uploads/sign`).
 * 2. Le navigateur envoie le fichier directement à Cloudinary : l'API ne voit jamais les octets.
 * 3. L'URL retournée est remise au parent via `onUploaded`.
 *
 * Le composant ne stocke rien : c'est au formulaire qui l'utilise d'enregistrer l'URL.
 */
export function UploadField({
  folder,
  kinds = ['IMAGE', 'DOCUMENT', 'VIDEO'],
  label = 'Ajouter un fichier',
  hint,
  disabled = false,
  className,
  onUploaded,
}: UploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<XMLHttpRequest | null>(null);
  const [state, setState] = useState<UploadState>({ step: 'idle' });

  const busy = state.step === 'signing' || state.step === 'uploading';
  const accept = uploadAcceptAttribute(kinds);
  const description = hint ?? `Formats acceptés : ${kinds.map((kind) => KIND_LABELS[kind]).join(', ')}.`;

  const reset = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    if (inputRef.current) inputRef.current.value = '';
    setState({ step: 'idle' });
  };

  const handleFile = async (file: File) => {
    // Contrôle immédiat côté client : le serveur refait la même vérification.
    const kind = uploadKindForContentType(file.type);
    if (!kind || !kinds.includes(kind)) {
      setState({ step: 'error', fileName: file.name, message: `Ce type de fichier n’est pas accepté. ${description}` });
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES[kind]) {
      const maxMo = Math.round(UPLOAD_MAX_BYTES[kind] / (1024 * 1024));
      setState({ step: 'error', fileName: file.name, message: `Ce fichier dépasse la taille maximale de ${maxMo} Mo.` });
      return;
    }

    setState({ step: 'signing', fileName: file.name });

    let signed: SignUploadResponse;
    try {
      const body: SignUploadRequest = { contentType: file.type, sizeBytes: file.size, folder, fileName: file.name };
      signed = await apiRequest<SignUploadResponse>('/v1/uploads/sign', { method: 'POST', body: JSON.stringify(body) });
    } catch (error) {
      setState({ step: 'error', fileName: file.name, message: error instanceof ApiError ? error.message : GENERIC_ERROR });
      return;
    }

    setState({ step: 'uploading', fileName: file.name, percent: 0 });

    try {
      const asset = await sendToCloudinary(file, signed, requestRef, (percent) =>
        setState({ step: 'uploading', fileName: file.name, percent }),
      );
      setState({ step: 'done', fileName: file.name, asset });
      onUploaded(asset);
    } catch (error) {
      if (error instanceof AbortedUpload) return;
      setState({ step: 'error', fileName: file.name, message: GENERIC_ERROR });
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={inputId} className="text-sm font-semibold text-foreground">
        {label}
      </label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled || busy}
        aria-describedby={`${inputId}-hint`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {state.step === 'idle' || state.step === 'error' ? (
        <Button
          type="button"
          variant="outline"
          block
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="min-h-11 justify-start"
        >
          <FileUp aria-hidden="true" />
          Choisir un fichier
        </Button>
      ) : null}

      {state.step === 'signing' || state.step === 'uploading' ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{state.fileName}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {state.step === 'signing' ? 'Préparation…' : `${state.percent} %`}
            </span>
          </div>
          <Progress
            value={state.step === 'uploading' ? state.percent : 0}
            aria-label={`Envoi de ${state.fileName}`}
          />
          <Button type="button" variant="ghost" size="sm" onClick={reset} className="self-end">
            <X aria-hidden="true" />
            Annuler
          </Button>
        </div>
      ) : null}

      {state.step === 'done' ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3 text-sm" aria-live="polite">
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{state.fileName}</p>
            <a
              href={state.asset.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {state.asset.url}
            </a>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={reset} aria-label="Remplacer le fichier">
            <RotateCcw aria-hidden="true" />
            Remplacer
          </Button>
        </div>
      ) : null}

      {state.step === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

class AbortedUpload extends Error {}

/** Réponse brute de l'API d'envoi Cloudinary (champs utilisés). */
type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
  resource_type: 'image' | 'video' | 'raw';
  bytes: number;
  format?: string;
  width?: number;
  height?: number;
};

/**
 * Envoi direct au navigateur → Cloudinary, en multipart, avec suivi de progression.
 * `XMLHttpRequest` est utilisé parce que `fetch` n'expose pas la progression d'envoi.
 */
function sendToCloudinary(
  file: File,
  signed: SignUploadResponse,
  requestRef: { current: XMLHttpRequest | null },
  onProgress: (percent: number) => void,
): Promise<UploadedAsset> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(signed.fields)) form.append(key, value);
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    requestRef.current = xhr;

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });
    xhr.addEventListener('abort', () => reject(new AbortedUpload()));
    xhr.addEventListener('error', () => reject(new Error('network')));
    xhr.addEventListener('load', () => {
      requestRef.current = null;
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`status ${xhr.status}`));
        return;
      }
      try {
        const body = JSON.parse(xhr.responseText) as CloudinaryUploadResponse;
        resolve({
          url: body.secure_url,
          publicId: body.public_id,
          resourceType: body.resource_type,
          bytes: body.bytes,
          format: body.format ?? null,
          width: body.width ?? null,
          height: body.height ?? null,
        });
      } catch {
        reject(new Error('invalid response'));
      }
    });

    xhr.open('POST', signed.uploadUrl);
    xhr.send(form);
  });
}
