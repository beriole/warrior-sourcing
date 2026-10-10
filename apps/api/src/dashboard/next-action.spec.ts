import { describe, expect, it } from 'vitest';
import { computeNextAction } from './next-action.js';

const base = {
  onboardingCompleted: true,
  activeOrders: 0,
  urgentStage: null,
  deliveredOrdersWithoutSales: 0,
};

describe('computeNextAction', () => {
  it("renvoie d'abord vers l'onboarding", () => {
    expect(computeNextAction({ ...base, onboardingCompleted: false, activeOrders: 3 }).id).toBe('onboarding');
  });

  it('priorise une marchandise à récupérer sur le simple suivi', () => {
    const action = computeNextAction({ ...base, activeOrders: 2, urgentStage: 'READY_FOR_PICKUP' });
    expect(action.id).toBe('pickup');
    expect(action.href).toBe('/importations');
  });

  it('invite à saisir les ventes une fois la marchandise reçue', () => {
    expect(computeNextAction({ ...base, deliveredOrdersWithoutSales: 1 }).id).toBe('sales');
  });

  it('propose le suivi quand une commande est en cours', () => {
    expect(computeNextAction({ ...base, activeOrders: 1, urgentStage: 'IN_TRANSIT' }).id).toBe('tracking');
  });

  it('propose le calculateur à un compte sans activité', () => {
    expect(computeNextAction(base).id).toBe('calculate');
  });
});
