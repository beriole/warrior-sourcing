import type { Metadata } from 'next';
import { FournisseursView } from '@/components/fournisseurs/fournisseurs-view';

export const metadata: Metadata = {
  title: 'Fournisseurs — Back-office Warrior Sourcing',
};

/** Fiches fournisseurs et niveaux de vérification, preuve à l'appui (ADM-04). */
export default function FournisseursPage() {
  return <FournisseursView />;
}
