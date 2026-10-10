import type { Metadata } from 'next';
import { ConversationView } from '@/components/messages/conversation-view';

export const metadata: Metadata = {
  title: 'Conversation — Warrior Sourcing',
};

/** Le paramètre est l'identifiant de la conversation. */
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConversationView id={id} />;
}
