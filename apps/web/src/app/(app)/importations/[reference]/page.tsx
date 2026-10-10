import type { Metadata } from 'next';
import { ImportationDetailView } from '@/components/importations/importation-detail-view';

export const metadata: Metadata = {
  title: 'Suivi de commande — Warrior Sourcing',
  description: 'Timeline des événements réels, preuves et rapports d’inspection de votre commande.',
};

/** Next 16 : les paramètres de route arrivent dans une promesse. */
export default async function ImportationPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return <ImportationDetailView reference={decodeURIComponent(reference)} />;
}
