import type { Metadata } from 'next';
import { CalculateurView } from '@/components/calculateur/calculateur-view';

export const metadata: Metadata = {
  title: 'Calculateur d’importation — Warrior Sourcing',
  description:
    'Estimez le coût réel d’une importation Chine → Cameroun : fret, taxes, frais annexes, marge et seuil de rentabilité.',
};

export default function CalculateurPage() {
  return <CalculateurView />;
}
