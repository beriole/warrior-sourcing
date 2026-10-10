import { describe, expect, it } from 'vitest';
import { courseAccess, lessonAccess, resourceAccess } from './access.js';

/**
 * Règles de droit d'accès (§54). Ce sont elles qui décident si une URL de lecture peut
 * exister : un refus mal rendu, et une vidéo payante devient gratuite.
 */
describe('Droit d’accès à une formation', () => {
  it('ouvre tout dès qu’une inscription existe', () => {
    for (const access of ['FREE', 'PAID', 'SUBSCRIPTION'] as const) {
      expect(courseAccess({ access, signedIn: true, enrolled: true }).allowed).toBe(true);
    }
  });

  it('refuse un visiteur sans session et lui dit de se connecter', () => {
    const decision = courseAccess({ access: 'FREE', signedIn: false, enrolled: false });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('SIGN_IN_REQUIRED');
    expect(decision.message).toContain('Connectez-vous');
  });

  it('ouvre une formation gratuite à un compte connecté', () => {
    expect(courseAccess({ access: 'FREE', signedIn: true, enrolled: false }).allowed).toBe(true);
  });

  it('refuse une formation payante à un compte sans inscription', () => {
    const decision = courseAccess({ access: 'PAID', signedIn: true, enrolled: false });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('PURCHASE_REQUIRED');
  });

  it('refuse une formation d’abonnement à un compte sans abonnement enregistré', () => {
    const decision = courseAccess({ access: 'SUBSCRIPTION', signedIn: true, enrolled: false });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('SUBSCRIPTION_REQUIRED');
  });
});

describe('Droit d’accès à une leçon', () => {
  it('laisse lire l’extrait offert, même sans compte', () => {
    expect(
      lessonAccess({ access: 'PAID', signedIn: false, enrolled: false, preview: true }).allowed,
    ).toBe(true);
  });

  it('ferme les autres leçons d’une formation payante', () => {
    expect(
      lessonAccess({ access: 'PAID', signedIn: true, enrolled: false, preview: false }).reason,
    ).toBe('PURCHASE_REQUIRED');
  });
});

describe('Droit de téléchargement d’une ressource', () => {
  it('ouvre une ressource libre à tout le monde', () => {
    expect(resourceAccess({ free: true, course: null, signedIn: false, enrolled: false }).allowed).toBe(true);
  });

  it('suit le droit de la formation quand la ressource y est rattachée', () => {
    expect(
      resourceAccess({ free: false, course: { access: 'PAID' }, signedIn: true, enrolled: false }).reason,
    ).toBe('PURCHASE_REQUIRED');
    expect(
      resourceAccess({ free: false, course: { access: 'PAID' }, signedIn: true, enrolled: true }).allowed,
    ).toBe(true);
  });

  it('exige au moins une session pour une ressource réservée sans formation', () => {
    expect(resourceAccess({ free: false, course: null, signedIn: false, enrolled: false }).reason).toBe(
      'SIGN_IN_REQUIRED',
    );
    expect(resourceAccess({ free: false, course: null, signedIn: true, enrolled: false }).allowed).toBe(true);
  });
});

/**
 * Le droit `ACADEMY_INCLUDED` de l'abonnement (§43).
 *
 * L'offre Business promettait « formations incluses » et ce droit n'était branché nulle
 * part : une formation marquée « incluse dans l'abonnement » restait fermée à qui l'avait
 * payée. Ces cas disent exactement ce que le droit ouvre, et surtout ce qu'il n'ouvre pas.
 */
describe('Formations incluses dans l’abonnement', () => {
  it('ouvre une formation incluse à un abonné qui porte le droit', () => {
    expect(
      courseAccess({ access: 'SUBSCRIPTION', signedIn: true, enrolled: false, academyIncluded: true })
        .allowed,
    ).toBe(true);
  });

  it('la garde fermée sans le droit', () => {
    expect(
      courseAccess({ access: 'SUBSCRIPTION', signedIn: true, enrolled: false, academyIncluded: false })
        .reason,
    ).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('n’ouvre pas une formation payante : c’est un achat distinct', () => {
    expect(
      courseAccess({ access: 'PAID', signedIn: true, enrolled: false, academyIncluded: true }).reason,
    ).toBe('PURCHASE_REQUIRED');
  });

  it('n’ouvre rien sans session, quel que soit le droit annoncé', () => {
    expect(
      courseAccess({ access: 'SUBSCRIPTION', signedIn: false, enrolled: false, academyIncluded: true })
        .reason,
    ).toBe('SIGN_IN_REQUIRED');
  });

  it('se propage aux leçons et aux ressources rattachées', () => {
    expect(
      lessonAccess({
        access: 'SUBSCRIPTION',
        signedIn: true,
        enrolled: false,
        preview: false,
        academyIncluded: true,
      }).allowed,
    ).toBe(true);
    expect(
      resourceAccess({
        free: false,
        course: { access: 'SUBSCRIPTION' },
        signedIn: true,
        enrolled: false,
        academyIncluded: true,
      }).allowed,
    ).toBe(true);
  });
});
