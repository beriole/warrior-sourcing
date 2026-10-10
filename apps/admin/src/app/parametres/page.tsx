import type { Metadata } from 'next';
import { ParametresView } from '@/components/parametres/parametres-view';

export const metadata: Metadata = {
  title: 'Paramètres — Back-office Warrior Sourcing',
};

/** État des intégrations : ce qui est configuré, et ce que l'absence entraîne. */
export default function ParametresPage() {
  return <ParametresView />;
}
