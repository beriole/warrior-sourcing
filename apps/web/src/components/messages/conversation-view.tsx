'use client';

import type { Message } from '@ws/contracts';
import { Badge, Button, Card, Skeleton } from '@ws/ui';
import { ArrowLeft, Paperclip, RefreshCw, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { dateMessage, useConversation, usePostMessage } from './messages-client';

/**
 * Une conversation et son fil (§32).
 *
 * Les messages de l'équipe sont alignés à gauche et les vôtres à droite : c'est la
 * convention que tout le monde connaît des messageries du téléphone, et elle évite de
 * lire l'auteur pour savoir qui parle.
 *
 * Une conversation close n'interdit pas d'écrire : le message rouvre le dossier. Obliger
 * à en ouvrir un autre ferait perdre le contexte, qui est tout ce qui fait la valeur d'un
 * échange écrit.
 */
export function ConversationView({ id }: { id: string }) {
  const { data, isPending, isError, error, refetch, isRefetching } = useConversation(id);
  const envoyer = usePostMessage(id);
  const [body, setBody] = useState('');

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6 md:px-6">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <Card className="text-center">
          <h1 className="font-display text-lg font-bold">Cette conversation n’a pas pu être chargée</h1>
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

  const { conversation } = data;

  async function repondre() {
    await envoyer.mutateAsync({ body: body.trim(), attachments: [] });
    setBody('');
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6 md:px-6 md:py-8">
      <Link
        href="/messages"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Messages
      </Link>

      <header>
        <h1 className="font-display text-xl font-bold tracking-tight">{conversation.subject}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{conversation.categoryLabel}</Badge>
          <Badge tone={conversation.status === 'ANSWERED' ? 'success' : conversation.status === 'CLOSED' ? 'neutral' : 'warning'}>
            {conversation.statusLabel}
          </Badge>
          {conversation.orderReference && (
            <span className="figures text-xs text-muted-foreground">{conversation.orderReference}</span>
          )}
        </div>
      </header>

      <ol className="grid gap-3">
        {conversation.messages.map((message) => (
          <li key={message.id}>
            <Bulle message={message} />
          </li>
        ))}
      </ol>

      <Card className="grid gap-3">
        {conversation.status === 'CLOSED' && (
          <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
            Cette conversation est close. Votre message la rouvrira.
          </p>
        )}

        <label className="grid gap-1 text-sm">
          <span className="sr-only">Votre réponse</span>
          <textarea
            value={body}
            rows={3}
            placeholder="Votre réponse…"
            onChange={(event) => setBody(event.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:border-primary"
          />
        </label>

        {envoyer.isError && (
          <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
            {envoyer.error instanceof Error ? envoyer.error.message : 'Le message n’a pas pu être envoyé.'}
          </p>
        )}

        <div>
          <Button loading={envoyer.isPending} disabled={body.trim().length === 0} onClick={() => void repondre()}>
            <Send aria-hidden />
            Envoyer
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Bulle({ message }: { message: Message }) {
  const deMoi = message.author === 'CLIENT';

  return (
    <div className={`flex ${deMoi ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          deMoi ? 'bg-imperial-soft' : 'border border-border bg-surface'
        }`}
      >
        <p className="text-xs font-semibold text-muted-foreground">
          {deMoi ? 'Vous' : message.authorName}
          <span className="figures ml-2 font-normal">{dateMessage(message.createdAt)}</span>
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{message.body}</p>

        {message.attachments.length > 0 && (
          <ul className="mt-2 grid gap-1">
            {message.attachments.map((piece) => (
              <li key={piece.id}>
                <a
                  href={piece.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  <Paperclip className="size-3.5" aria-hidden />
                  {piece.title}
                  <span className="figures text-xs font-normal text-muted-foreground">
                    {piece.fileFormat.toUpperCase()}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
