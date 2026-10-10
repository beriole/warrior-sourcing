import type { Metadata } from 'next';
import { DashboardView } from '@/components/dashboard/dashboard-view';

export const metadata: Metadata = {
  title: 'Mon espace — Warrior Sourcing',
  description: 'Votre activité d’importation, votre prochaine action et vos opportunités.',
};

export default function DashboardPage() {
  return <DashboardView />;
}
