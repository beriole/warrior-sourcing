import { describe, expect, it } from 'vitest';
import { subscriptionCovers, subscriptionEnd } from './subscriptions.js';

/**
 * Durée d'un abonnement.
 *
 * Les bornes de mois sont la seule partie réellement piégeuse : un abonnement souscrit le
 * 31 janvier ne doit pas courir jusqu'au 3 mars, et un 29 février ne doit pas disparaître
 * les années non bissextiles.
 */
describe('subscriptionEnd', () => {
  it('ajoute un mois', () => {
    const fin = subscriptionEnd(new Date('2026-03-10T08:00:00.000Z'), 'MONTHLY');
    expect(fin.getMonth()).toBe(3);
    expect(fin.getDate()).toBe(10);
  });

  it('ajoute un an', () => {
    const debut = new Date('2026-03-10T08:00:00.000Z');
    const fin = subscriptionEnd(debut, 'YEARLY');
    expect(fin.getFullYear()).toBe(debut.getFullYear() + 1);
    expect(fin.getMonth()).toBe(debut.getMonth());
  });

  it('ramène au dernier jour du mois quand le quantième n’existe pas', () => {
    // 31 janvier + 1 mois : février n'a pas de 31. On s'arrête au 28, pas au 3 mars.
    const fin = subscriptionEnd(new Date(2026, 0, 31, 8, 0, 0), 'MONTHLY');
    expect(fin.getMonth()).toBe(1);
    expect(fin.getDate()).toBe(28);
  });

  it('gère le 29 février vers une année non bissextile', () => {
    // 2028 est bissextile, 2029 ne l'est pas : le 29 février devient le 28.
    const fin = subscriptionEnd(new Date(2028, 1, 29, 8, 0, 0), 'YEARLY');
    expect(fin.getFullYear()).toBe(2029);
    expect(fin.getMonth()).toBe(1);
    expect(fin.getDate()).toBe(28);
  });
});

describe('subscriptionCovers', () => {
  const periode = {
    startsAt: new Date('2026-03-01T00:00:00.000Z'),
    endsAt: new Date('2026-04-01T00:00:00.000Z'),
  };

  it('couvre un instant à l’intérieur de la période', () => {
    expect(
      subscriptionCovers({ ...periode, status: 'ACTIVE' }, new Date('2026-03-15T00:00:00.000Z')),
    ).toBe(true);
  });

  it('ne couvre pas avant le début ni à partir de la fin', () => {
    expect(
      subscriptionCovers({ ...periode, status: 'ACTIVE' }, new Date('2026-02-28T00:00:00.000Z')),
    ).toBe(false);
    // La fin est exclue : à l'instant exact de l'échéance, les droits sont fermés.
    expect(
      subscriptionCovers({ ...periode, status: 'ACTIVE' }, new Date('2026-04-01T00:00:00.000Z')),
    ).toBe(false);
  });

  it('n’ouvre aucun droit tant que le paiement n’est pas confirmé', () => {
    expect(
      subscriptionCovers({ ...periode, status: 'PENDING_PAYMENT' }, new Date('2026-03-15T00:00:00.000Z')),
    ).toBe(false);
  });

  it('n’ouvre aucun droit sur un abonnement résilié ou expiré', () => {
    const milieu = new Date('2026-03-15T00:00:00.000Z');
    expect(subscriptionCovers({ ...periode, status: 'CANCELLED' }, milieu)).toBe(false);
    expect(subscriptionCovers({ ...periode, status: 'EXPIRED' }, milieu)).toBe(false);
  });
});
