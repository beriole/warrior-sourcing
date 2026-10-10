import type { Metadata } from 'next';
import { ServicesView } from '@/components/services/services-view';

export const metadata: Metadata = {
  title: 'Services — Warrior Sourcing',
  description:
    'Recherche de fournisseur, vérification, inspection, négociation, achat assisté, consolidation, transport, personnalisation et accompagnement.',
};

export default function ServicesPage() {
  return <ServicesView />;
}
