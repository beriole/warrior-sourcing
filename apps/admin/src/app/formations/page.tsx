import type { Metadata } from 'next';
import { FormationsView } from '@/components/formations/formations-view';

export const metadata: Metadata = {
  title: 'Formations — Back-office Warrior Sourcing',
};

/** Programme, leçons, publication et bibliothèque de l'Academy (ADM-05). */
export default function FormationsPage() {
  return <FormationsView />;
}
