import { render } from '@react-email/render';
import { getEmail, type EmailKey } from './registry.js';

export type RenderedEmail = {
  subject: string;
  html: string;
  /** Version texte, pour les clients qui refusent le HTML et pour l'accessibilité. */
  text: string;
};

/**
 * Rend un email à partir de sa clé et de ses données.
 * Les données sont validées par le schéma du template : une donnée manquante prend sa valeur
 * par défaut, une donnée invalide ne casse pas l'envoi.
 */
export async function renderEmail(key: EmailKey, data?: unknown, options?: { pretty?: boolean }): Promise<RenderedEmail> {
  const { subject, element } = getEmail(key).build(data);

  const [html, text] = await Promise.all([
    render(element, { pretty: options?.pretty ?? false }),
    render(element, { plainText: true }),
  ]);

  return { subject, html, text };
}
