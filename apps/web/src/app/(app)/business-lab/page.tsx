import type { Metadata } from 'next';
import { BusinessLabView } from '@/components/business-lab/business-lab-view';

export const metadata: Metadata = {
  title: 'Business Lab — Warrior Sourcing',
  description: 'Capital engagé, ventes saisies, marge constatée et capital récupéré sur chaque importation.',
};

export default function BusinessLabPage() {
  return <BusinessLabView />;
}
