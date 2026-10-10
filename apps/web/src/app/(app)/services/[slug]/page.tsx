import type { Metadata } from 'next';
import { ServiceDetailView } from '@/components/services/service-detail-view';

export const metadata: Metadata = {
  title: 'Prestation — Services — Warrior Sourcing',
  description: 'Tarif, délai, livrables et conditions d’une prestation, et demande en ligne.',
};

/** Le paramètre est le libellé d'URL de la prestation. */
export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ServiceDetailView slug={slug} />;
}
