import type { Metadata } from 'next';
import { ProductDetailView } from '@/components/opportunites/product-detail-view';

export const metadata: Metadata = {
  title: 'Fiche produit — Warrior Sourcing',
  description:
    'Coûts estimés, prix local observé et daté, marge potentielle et ses hypothèses, points de vigilance et fournisseurs associés.',
};

/** L'identifiant peut être celui du produit ou le libellé de son URL. */
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetailView idOrSlug={id} />;
}
