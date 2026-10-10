import type { Metadata } from 'next';
import { RechercheView } from '@/components/recherche/recherche-view';

export const metadata: Metadata = {
  title: 'Recherche — Warrior Sourcing',
  description: 'Chercher un produit, un fournisseur, une formation ou une prestation.',
};

/** Le terme cherché voyage dans l'URL : un résultat se partage et se remet en favori. */
export default async function RecherchePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <RechercheView initial={q ?? ''} />;
}
