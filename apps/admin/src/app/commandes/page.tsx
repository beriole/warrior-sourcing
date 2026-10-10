import type { Metadata } from 'next';
import { CommandesView } from '@/components/commandes/commandes-view';

export const metadata: Metadata = {
  title: 'Commandes — Back-office Warrior Sourcing',
};

/** Liste filtrable, détail et changement d'état encadré des commandes (ADM-06). */
export default function CommandesPage() {
  return <CommandesView />;
}
