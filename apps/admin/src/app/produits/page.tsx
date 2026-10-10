import type { Metadata } from 'next';
import { ProduitsView } from '@/components/produits/produits-view';

export const metadata: Metadata = {
  title: 'Produits — Back-office Warrior Sourcing',
};

/** Création, édition, publication et retrait des fiches produits (ADM-03). */
export default function ProduitsPage() {
  return <ProduitsView />;
}
