import type { Metadata } from 'next';
import { ImportationsView } from '@/components/importations/importations-view';

export const metadata: Metadata = {
  title: 'Mes importations — Warrior Sourcing',
  description: 'Suivi réel de vos commandes, étape par étape, de la Chine jusqu’au Cameroun.',
};

/** Liste des commandes suivies (LOG-02). */
export default function ImportationsPage() {
  return <ImportationsView />;
}
