import { redirect } from 'next/navigation';

/**
 * Les dossiers de support ouverts sur une commande sont traités comme des litiges (§39).
 * L'entrée « Tickets » du menu mène donc à l'écran des litiges.
 */
export default function TicketsPage() {
  redirect('/litiges');
}
