import type { Metadata } from 'next';
import { MessagesView } from '@/components/messages/messages-view';

export const metadata: Metadata = {
  title: 'Messages — Warrior Sourcing',
  description: 'Vos échanges avec l’équipe : support, sourcing, logistique, formation.',
};

export default function MessagesPage() {
  return <MessagesView />;
}
