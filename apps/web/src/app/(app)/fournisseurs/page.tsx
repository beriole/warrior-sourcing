import type { Metadata } from 'next';
import { SuppliersView } from '@/components/fournisseurs/suppliers-view';

export const metadata: Metadata = {
  title: 'Fournisseurs — Warrior Sourcing',
  description:
    'Fournisseurs chinois référencés, avec leur niveau de vérification, la preuve qui le justifie et les incidents connus.',
};

export default function SuppliersPage() {
  return <SuppliersView />;
}
