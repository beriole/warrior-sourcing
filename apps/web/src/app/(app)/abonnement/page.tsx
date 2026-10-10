import type { Metadata } from 'next';
import { AbonnementView } from '@/components/abonnement/abonnement-view';

export const metadata: Metadata = {
  title: 'Abonnement — Warrior Sourcing',
  description: 'Les formules Gratuit, Pro et Business : ce que chacune ouvre réellement.',
};

export default function AbonnementPage() {
  return <AbonnementView />;
}
