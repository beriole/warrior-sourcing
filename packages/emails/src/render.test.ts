import { describe, expect, it } from 'vitest';
import { EMAIL_KEYS, getEmail } from './registry.js';
import { renderEmail } from './render.js';

const CASES = EMAIL_KEYS.flatMap((key) =>
  Object.keys(getEmail(key).fixtures).map((fixture) => ({ key, fixture, data: getEmail(key).fixtures[fixture] })),
);

describe('rendu des emails', () => {
  it.each(CASES)('$key / $fixture produit un email complet', async ({ key, data }) => {
    const { subject, html, text } = await renderEmail(key, data);

    expect(subject.length).toBeGreaterThan(5);
    expect(html).toContain('<!DOCTYPE html');
    expect(text.length).toBeGreaterThan(80);
  });

  it.each(CASES)('$key / $fixture ne laisse fuir aucune valeur manquante', async ({ key, data }) => {
    const { subject, html } = await renderEmail(key, data);

    for (const leak of ['undefined', 'NaN', '[object Object]', 'null']) {
      expect(html).not.toContain(`>${leak}<`);
      expect(subject).not.toContain(leak);
    }
  });

  it.each(EMAIL_KEYS)('%s reste lisible sans aucune donnée', async (key) => {
    // Cas limite : aucune donnée transmise. Les valeurs par défaut doivent suffire.
    const { subject, html, text } = await renderEmail(key, {});

    expect(subject.trim().length).toBeGreaterThan(5);
    expect(html).toContain('WARRIOR');
    expect(text).toContain('WARRIOR SOURCING');
  });

  it.each(CASES)('$key / $fixture ne dépend d’aucune image distante', async ({ key, data }) => {
    // Images bloquées par défaut dans Outlook et Gmail : aucun visuel ne doit venir du réseau.
    const { html } = await renderEmail(key, data);
    expect(html).not.toMatch(/<img[^>]+src="https?:/i);
  });

  it('applique la largeur de contenu recommandée', async () => {
    const { html } = await renderEmail('welcome', {});
    expect(html).toContain('640px');
  });

  it('prévoit un repli pour chaque dégradé et garde les animations optionnelles', async () => {
    const { html } = await renderEmail('payment-confirmed', {});

    // Une couleur pleine accompagne toujours le dégradé, pour Outlook.
    expect(html).toMatch(/background-color:#[0-9a-f]{6}[^"]*background-image:linear-gradient/i);
    // Les classes d'animation existent, mais l'état visible ne dépend pas d'elles.
    expect(html).toContain('ws-rise');
    expect(html).toContain('prefers-reduced-motion');
  });

  it('adapte le contenu au mobile', async () => {
    const { html } = await renderEmail('sourcing-result', getEmail('sourcing-result').fixtures['3 fournisseurs']);
    expect(html).toContain('max-width: 620px');
    expect(html).toContain('sm-stack');
  });
});

describe('robustesse des données', () => {
  it('tronque un prénom trop long au lieu de casser la mise en page', async () => {
    const { html } = await renderEmail('welcome', { firstName: 'Marie-Emmanuelle Ngo Bikoï Tsagué Djeumé' });
    expect(html).toContain('Marie-Emmanuelle Ngo Bikoï…');
  });

  it('dit simplement « Bonjour, » quand le prénom manque', async () => {
    const { text } = await renderEmail('welcome', { firstName: '   ' });
    expect(text).toContain('Bonjour,');
  });

  it('remplace une valeur invalide par une valeur sûre', async () => {
    const { html, subject } = await renderEmail('shipment-update', { stage: 'ÉTAPE_INEXISTANTE', eventAt: 'pas une date' });

    expect(subject).toContain('Transit');
    // Une date illisible devient un tiret, jamais « Invalid Date ».
    expect(html).not.toContain('Invalid Date');
  });

  it('affiche un montant important en entier', async () => {
    const { html } = await renderEmail('payment-confirmed', { amount: { amountMinor: 18_750_000, currency: 'XAF' } });
    expect(html.replaceAll(/\s/g, '')).toContain('18750000FCFA'.replaceAll(/\s/g, ''));
  });

  it('gère une commande sans aucune ligne d’articles', async () => {
    const { html } = await renderEmail('order-confirmed', { orderReference: '#WR-1' });
    expect(html).toContain('Le détail des articles sera visible dans votre espace.');
  });

  it('gère un sourcing sans proposition', async () => {
    const { subject, html } = await renderEmail('sourcing-result', { suppliers: [], productLabel: 'Presse hydraulique' });
    expect(subject).toContain('Presse hydraulique');
    expect(html).toContain('Recherche en cours');
  });
});
