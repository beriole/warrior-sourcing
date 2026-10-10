import type { Metadata } from 'next';
import { AcademyView } from '@/components/academy/academy-view';

export const metadata: Metadata = {
  title: 'Academy — Warrior Sourcing',
  description:
    'Formations courtes sur l’importation depuis la Chine : recherche de produits, fournisseurs, négociation, transport, douane et vente au Cameroun.',
};

export default function AcademyPage() {
  return <AcademyView />;
}
