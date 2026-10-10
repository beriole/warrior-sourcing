'use client';

import {
  CONVERSATION_CATEGORIES,
  CONVERSATION_CATEGORY_LABELS,
  type ConversationCategory,
  type ConversationSummary,
} from '@ws/contracts';
import { Badge, Button, Card, Entree, GrilleAnimee, Skeleton } from '@ws/ui';
import { MessageSquare, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { dateMessage, useConversations, useCreateConversation } from './messages-client';

const FORM_VIDE = {
  category: 'SUPPORT' as ConversationCategory,
  subject: '',
  orderReference: '',
  body: '',
};

/**
 * Messagerie (§32, MSG-01).
 *
 * Quatre guichets plutôt qu'une boîte unique : une question de douane et une question de
 * facturation ne se traitent pas par les mêmes personnes, et un dossier rangé dans le bon
 * guichet trouve sa réponse plus vite.
 *
 * L'état affiché vient du serveur, qui le déduit de qui a écrit en dernier : l'écran ne
 * peut donc pas afficher « répondu » sur un dossier sans réponse.
 */
export function MessagesView() {
  const router = useRouter();
  const [categorie, setCategorie] = useState<ConversationCategory | null>(null);
  const [ouverture, setOuverture] = useState(false);
  const [form, setForm] = useState(FORM_VIDE);

  const { data, isPending, isError, error, refetch, isRefetching } = useConversations(
    categorie ?? undefined,
  );
  const ouvrir = useCreateConversation();

  const complet = form.subject.trim().length >= 5 && form.body.trim().length >= 20;

  async function envoyer() {
    const reponse = await ouvrir.mutateAsync({
      category: form.category,
      subject: form.subject.trim(),
      orderReference: form.orderReference.trim() || null,
      body: form.body.trim(),
      attachments: [],
    });
    setOuverture(false);
    setForm(FORM_VIDE);
    router.push(`/messages/${reponse.conversation.id}`);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Entree geste="paragraphe" as="header">
        <h1 className="font-display text-2xl font-bold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vos échanges avec l’équipe, rangés par guichet. Rattachez une commande et vous n’aurez pas à
          répéter sa référence.
        </p>
      </Entree>

      {!ouverture && (
        <div>
          <Button onClick={() => setOuverture(true)}>
            <Plus aria-hidden />
            Nouvelle conversation
          </Button>
        </div>
      )}

      {ouverture && (
        <Card className="grid gap-3">
          <h2 className="text-base font-semibold">Nouvelle conversation</h2>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Guichet</legend>
            <div className="flex flex-wrap gap-2">
              {CONVERSATION_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setForm({ ...form, category })}
                  aria-pressed={form.category === category}
                  className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
                    form.category === category
                      ? 'border-primary bg-imperial-soft'
                      : 'border-border bg-surface hover:bg-surface-muted'
                  }`}
                >
                  {CONVERSATION_CATEGORY_LABELS[category].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {CONVERSATION_CATEGORY_LABELS[form.category].description}
            </p>
          </fieldset>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Sujet</span>
            <input
              value={form.subject}
              maxLength={140}
              placeholder="Colis bloqué à la douane"
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
              className="h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Référence concernée (facultatif)</span>
            <input
              value={form.orderReference}
              maxLength={40}
              placeholder="WS-… ou SRV-…"
              onChange={(event) => setForm({ ...form, orderReference: event.target.value })}
              className="figures h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Votre message</span>
            <textarea
              value={form.body}
              rows={5}
              placeholder="Décrivez la situation : ce qui s’est passé, depuis quand, ce que vous avez déjà tenté."
              onChange={(event) => setForm({ ...form, body: event.target.value })}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:border-primary"
            />
            <span className="text-xs text-muted-foreground">
              Vingt caractères au moins : c’est ce message qui ouvre le dossier.
            </span>
          </label>

          {ouvrir.isError && (
            <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              {ouvrir.error instanceof Error ? ouvrir.error.message : 'La conversation n’a pas pu être ouverte.'}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button loading={ouvrir.isPending} disabled={!complet} onClick={() => void envoyer()}>
              Envoyer
            </Button>
            <Button variant="outline" onClick={() => setOuverture(false)}>
              Annuler
            </Button>
          </div>
        </Card>
      )}

      {data && data.counts.length > 1 && (
        <nav aria-label="Guichets" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex w-max gap-2">
            <li>
              <button type="button" onClick={() => setCategorie(null)} className={onglet(categorie === null)}>
                Tout
              </button>
            </li>
            {data.counts.map(({ category, label, count }) => (
              <li key={category}>
                <button
                  type="button"
                  onClick={() => setCategorie(category)}
                  className={onglet(categorie === category)}
                >
                  {label}
                  <span className="figures ml-1.5 text-xs font-normal opacity-70">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {isPending ? (
        <div className="grid gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Card className="text-center">
          <h2 className="font-display text-lg font-bold">Vos conversations n’ont pas pu être chargées</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Connectez-vous pour retrouver vos échanges.'}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      ) : data.items.length === 0 ? (
        <Card className="flex flex-col items-start">
          <span className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
            <MessageSquare className="size-5" aria-hidden />
          </span>
          <h2 className="font-semibold">Aucune conversation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Une question sur un colis, un fournisseur, une facture ou une formation : ouvrez un dossier,
            l’échange reste consultable ensuite.
          </p>
        </Card>
      ) : (
        <GrilleAnimee signature={`conv-${categorie ?? 'tout'}-${data.items.length}`} className="grid gap-2">
          {data.items.map((conversation) => (
            <ConversationTuile key={conversation.id} conversation={conversation} />
          ))}
        </GrilleAnimee>
      )}
    </div>
  );
}

function ConversationTuile({ conversation }: { conversation: ConversationSummary }) {
  return (
    <Card className="p-0">
      <Link
        href={`/messages/${conversation.id}`}
        className="grid gap-1.5 rounded-lg p-4 focus-visible:ring-2 focus-visible:ring-imperial focus-visible:outline-none"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{conversation.subject}</span>
          <Badge tone="neutral">{conversation.categoryLabel}</Badge>
          {conversation.unreadCount > 0 && (
            <Badge tone="brand">
              {conversation.unreadCount} nouveau{conversation.unreadCount > 1 ? 'x' : ''}
            </Badge>
          )}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{conversation.lastMessagePreview}</p>
        <p className="figures text-xs text-muted-foreground">
          {conversation.statusLabel} · {dateMessage(conversation.lastMessageAt)} ·{' '}
          {conversation.messageCount} message{conversation.messageCount > 1 ? 's' : ''}
          {conversation.orderReference && ` · ${conversation.orderReference}`}
        </p>
      </Link>
    </Card>
  );
}

function onglet(actif: boolean): string {
  return `min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
    actif
      ? 'border-transparent bg-night text-white'
      : 'border-border bg-surface text-foreground hover:bg-surface-muted'
  }`;
}
