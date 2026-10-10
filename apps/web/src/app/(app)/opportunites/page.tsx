import type { Metadata } from 'next';
import { OpportunitesView } from '@/components/opportunites/opportunites-view';

export const metadata: Metadata = {
  title: 'Opportunités — Warrior Sourcing',
  description:
    'Produits à importer de Chine : prix d’achat, coût rendu estimé au Cameroun, prix local observé et marge potentielle.',
};

export default function OpportunitesPage() {
  return <OpportunitesView />;
}
