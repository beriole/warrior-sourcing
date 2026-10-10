import type { Metadata } from 'next';
import { CargoView } from '@/components/cargo/cargo-view';

export const metadata: Metadata = {
  title: 'Transitaires et tarifs — Back-office Warrior Sourcing',
};

/** Écran d'administration des transitaires et de leurs grilles (CARGO-04). Accessible sur /cargo. */
export default function CargoPage() {
  return <CargoView />;
}
