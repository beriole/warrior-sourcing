import type { Metadata } from 'next';
import { SupplierDetailView } from '@/components/fournisseurs/supplier-detail-view';

export const metadata: Metadata = {
  title: 'Fiche fournisseur — Warrior Sourcing',
  description:
    'Usine, produits, conditions, documents contrôlés, incidents et photos réelles. Les coordonnées sont réservées aux membres.',
};

/** Next 16 : les paramètres de route arrivent dans une promesse. */
export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierDetailView id={id} />;
}
