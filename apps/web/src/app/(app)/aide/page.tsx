import type { Metadata } from 'next';
import { AideView } from '@/components/aide/aide-view';

export const metadata: Metadata = {
  title: 'Aide — Warrior Sourcing',
  description: 'Questions fréquentes sur les coûts, les badges fournisseurs, le paiement et le suivi.',
};

export default function AidePage() {
  return <AideView />;
}
