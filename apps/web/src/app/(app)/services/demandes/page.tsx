import type { Metadata } from 'next';
import { ServiceOrdersView } from '@/components/services/service-orders-view';

export const metadata: Metadata = {
  title: 'Mes demandes — Services — Warrior Sourcing',
};

export default function ServiceOrdersPage() {
  return <ServiceOrdersView />;
}
