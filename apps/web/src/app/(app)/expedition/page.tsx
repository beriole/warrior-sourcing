import type { Metadata } from 'next';
import { AssistantAdresse } from '@/components/expedition/assistant-adresse';

export const metadata: Metadata = {
  title: 'Adresse d’expédition — Warrior Sourcing',
  description:
    'Quelle adresse donner à votre fournisseur chinois, avec votre code client, et les erreurs qui coûtent le plus cher.',
};

export default function ExpeditionPage() {
  return <AssistantAdresse />;
}
