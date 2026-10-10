import type { Metadata } from 'next';
import { OffresView } from '@/components/offres/offres-view';

export const metadata: Metadata = {
  title: 'Offres d’abonnement — Back-office Warrior Sourcing',
};

/** Prix et droits des offres d'abonnement (§43). */
export default function OffresPage() {
  return <OffresView />;
}
