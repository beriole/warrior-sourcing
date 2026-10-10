import type { Metadata } from 'next';
import { LogistiqueView } from '@/components/logistique/logistique-view';

export const metadata: Metadata = {
  title: 'Logistique — Back-office Warrior Sourcing',
};

/** Vue opérationnelle des agents logistiques (LOG-04, LOG-05). Accessible sur /logistique. */
export default function LogistiquePage() {
  return <LogistiqueView />;
}
