import type { Metadata } from 'next';
import { UtilisateursView } from '@/components/utilisateurs/utilisateurs-view';

export const metadata: Metadata = {
  title: 'Utilisateurs et rôles — Back-office Warrior Sourcing',
};

/** Comptes, rôles et journalisation des promotions (ADM-07). */
export default function UtilisateursPage() {
  return <UtilisateursView />;
}
