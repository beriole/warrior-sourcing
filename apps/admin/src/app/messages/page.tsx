import type { Metadata } from 'next';
import { MessagesView } from '@/components/messages/messages-view';

export const metadata: Metadata = {
  title: 'Messages — Back-office Warrior Sourcing',
};

/** Boîte de réception de l'équipe : répondre et clore (MSG-01). */
export default function MessagesPage() {
  return <MessagesView />;
}
