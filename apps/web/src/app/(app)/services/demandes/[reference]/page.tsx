import type { Metadata } from 'next';
import { ServiceOrderView } from '@/components/services/service-order-view';

export const metadata: Metadata = {
  title: 'Suivi d’une demande — Services — Warrior Sourcing',
};

/** Le paramètre est la référence lisible de la demande (SRV-XXXXXXXX). */
export default async function ServiceOrderPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return <ServiceOrderView reference={reference} />;
}
