import type { Metadata } from 'next';
import { PromotionsView } from '@/components/promotions/promotions-view';

export const metadata: Metadata = {
  title: 'Promotions — Back-office Warrior Sourcing',
};

/** Remises sur les formations et les abonnements (§43). */
export default function PromotionsPage() {
  return <PromotionsView />;
}
