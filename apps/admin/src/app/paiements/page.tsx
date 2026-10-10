import type { Metadata } from 'next';
import { PaiementsView } from '@/components/paiements/paiements-view';

export const metadata: Metadata = {
  title: 'Paiements — Back-office Warrior Sourcing',
};

/** Paiements en lecture seule : leur état vient de l'agrégateur (ADM-06). */
export default function PaiementsPage() {
  return <PaiementsView />;
}
