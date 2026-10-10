'use client';

import {
  CONVERSATION_CATEGORIES,
  CONVERSATION_CATEGORY_LABELS,
  CONVERSATION_STATUSES,
  CONVERSATION_STATUS_LABELS,
  type ConversationCategory,
  type ConversationListResponse,
  type ConversationResponse,
  type ConversationStatus,
} from '@ws/contracts';
import { Badge, Button, Card } from '@ws/ui';
import { CheckCircle2, Paperclip, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { appelApi, dateHeure, etatDepuisErreur, type EtatAcces } from '@/components/admin/api';
import { ChampChoix } from '@/components/admin/champs';
import {
  EcranAcces,
  EnTete,
  EtatVide,
  MessageErreur,
  MessageInfo,
  SqueletteListe,
} from '@/components/admin/etats';

function tonStatut(status: ConversationStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'ANSWERED') return 'success';
  if (status === 'OPEN') return 'warning';
  return 'neutral';
}

/**
 * Boîte de réception de l'équipe (§32, MSG-01).
 *
 * Les dossiers en attente de réponse sont mis en tête de ce que l'écran annonce : c'est
 * la seule information qui fait agir. Un dossier auquel on a déjà répondu n'a pas besoin
 * d'attirer l'œil.
 *
 * L'état « répondu » n'est jamais posé à la main : il suit l'envoi d'une réponse réelle.
 */
export function MessagesView() {
  const [liste, setListe] = useState<ConversationListResponse | null>(null);
  const [detail, setDetail] = useState<ConversationResponse['conversation'] | null>(null);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<EtatAcces>('ok');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [filtreCategorie, setFiltreCategorie] = useState<ConversationCategory | ''>('');
  const [filtreStatut, setFiltreStatut] = useState<ConversationStatus | ''>('');
  const [version, setVersion] = useState(0);

  const [reponse, setReponse] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const traiterErreur = useCallback((e: unknown) => {
    const etat = etatDepuisErreur(e);
    if (etat) setAcces(etat);
    else setErreur(e instanceof Error ? e.message : 'Une erreur inattendue s’est produite.');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ toutes: 'true', perPage: '50' });
    if (filtreCategorie) params.set('category', filtreCategorie);
    if (filtreStatut) params.set('statut', filtreStatut);
    appelApi<ConversationListResponse>(`/conversations?${params.toString()}`)
      .then((data) => {
        setListe(data);
        setAcces('ok');
      })
      .catch(traiterErreur)
      .finally(() => setChargement(false));
  }, [filtreCategorie, filtreStatut, version, traiterErreur]);

  function rafraichir() {
    setChargement(true);
    setVersion((v) => v + 1);
  }

  async function ouvrir(id: string) {
    setErreur(null);
    setInfo(null);
    setReponse('');
    try {
      const data = await appelApi<ConversationResponse>(`/conversations/${id}`);
      setDetail(data.conversation);
      // Ouvrir vaut lecture côté serveur : la pastille de la liste doit suivre.
      rafraichir();
    } catch (e) {
      traiterErreur(e);
    }
  }

  async function repondre() {
    if (!detail) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const data = await appelApi<ConversationResponse>(`/conversations/${detail.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: reponse.trim(), attachments: [] }),
      });
      setDetail(data.conversation);
      setReponse('');
      setInfo('Réponse envoyée.');
      rafraichir();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  async function clore() {
    if (!detail) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const data = await appelApi<ConversationResponse>(`/conversations/${detail.id}/cloture`, {
        method: 'PATCH',
      });
      setDetail(data.conversation);
      setInfo('Conversation close. Un message du client la rouvrira.');
      rafraichir();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnvoi(false);
    }
  }

  if (acces !== 'ok') {
    return <EcranAcces etat={acces} sujet="lire les conversations" onReessayer={rafraichir} />;
  }

  const enAttente = liste?.items.filter((item) => item.status === 'OPEN').length ?? 0;

  return (
    <div className="grid gap-5">
      <EnTete
        titre="Messages"
        sousTitre="Les dossiers en attente de réponse d’abord : ce sont les seuls qui demandent une action."
      />

      <p className="text-xs text-muted-foreground">
        {enAttente > 0 ? (
          <span className="font-semibold text-warning">
            {enAttente} dossier{enAttente > 1 ? 's' : ''} en attente de réponse
          </span>
        ) : (
          'Aucun dossier en attente de réponse.'
        )}
        {liste && ` · ${liste.total} conversation${liste.total > 1 ? 's' : ''} au total`}
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <ChampChoix
          label="Guichet"
          value={filtreCategorie}
          onChange={setFiltreCategorie}
          vide="Tous"
          options={CONVERSATION_CATEGORIES.map((category) => ({
            value: category,
            label: CONVERSATION_CATEGORY_LABELS[category].label,
          }))}
        />
        <ChampChoix
          label="État"
          value={filtreStatut}
          onChange={setFiltreStatut}
          vide="Tous"
          options={CONVERSATION_STATUSES.map((status) => ({
            value: status,
            label: CONVERSATION_STATUS_LABELS[status].label,
          }))}
        />
      </div>

      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {info && <MessageInfo>{info}</MessageInfo>}

      {chargement ? (
        <SqueletteListe />
      ) : !liste || liste.items.length === 0 ? (
        <EtatVide titre="Aucune conversation" explication="Modifiez les filtres, ou attendez un message." />
      ) : (
        <ul className="grid gap-2">
          {liste.items.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => void ouvrir(conversation.id)}
                aria-current={detail?.id === conversation.id ? 'true' : undefined}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  detail?.id === conversation.id
                    ? 'border-primary bg-surface-muted'
                    : 'border-border bg-surface hover:bg-surface-muted'
                }`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{conversation.subject}</span>
                  <Badge tone={tonStatut(conversation.status)}>{conversation.statusLabel}</Badge>
                  <Badge tone="neutral">{conversation.categoryLabel}</Badge>
                  {conversation.unreadCount > 0 && (
                    <Badge tone="brand">{conversation.unreadCount} non lu{conversation.unreadCount > 1 ? 's' : ''}</Badge>
                  )}
                </span>
                <span className="mt-1 block line-clamp-1 text-sm text-muted-foreground">
                  {conversation.lastMessagePreview}
                </span>
                <span className="figures mt-0.5 block text-xs text-muted-foreground">
                  {conversation.clientName} · {dateHeure(conversation.lastMessageAt)}
                  {conversation.orderReference && ` · ${conversation.orderReference}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {detail && (
        <Card className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{detail.subject}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {detail.clientName} · {detail.categoryLabel}
                {detail.orderReference && ` · ${detail.orderReference}`}
              </p>
            </div>
            <Badge tone={tonStatut(detail.status)}>{detail.statusLabel}</Badge>
          </div>

          <ol className="grid gap-2">
            {detail.messages.map((message) => (
              <li
                key={message.id}
                className={`rounded-md border p-3 text-sm ${
                  message.author === 'STAFF' ? 'border-primary/30 bg-imperial-soft' : 'border-border'
                }`}
              >
                <p className="text-xs font-semibold text-muted-foreground">
                  {message.authorName}
                  <span className="figures ml-2 font-normal">{dateHeure(message.createdAt)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                {message.attachments.length > 0 && (
                  <ul className="mt-2 grid gap-1">
                    {message.attachments.map((piece) => (
                      <li key={piece.id}>
                        <a
                          href={piece.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                        >
                          <Paperclip className="size-3.5" aria-hidden />
                          {piece.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Votre réponse</span>
            <textarea
              value={reponse}
              rows={4}
              onChange={(event) => setReponse(event.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:border-primary"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button loading={envoi} disabled={reponse.trim().length === 0} onClick={() => void repondre()}>
              <Send aria-hidden />
              Répondre
            </Button>
            <Button
              variant="outline"
              loading={envoi}
              disabled={detail.status === 'CLOSED'}
              onClick={() => void clore()}
            >
              <CheckCircle2 aria-hidden />
              Clore le dossier
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
