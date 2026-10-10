import { describe, expect, it } from 'vitest';
import {
  canPromoteTo,
  currentVerification,
  levelsAtLeast,
  toProofs,
  type VerificationRecord,
} from './verification.js';

function record(partial: Partial<VerificationRecord>): VerificationRecord {
  return {
    id: 'v1',
    level: 'IDENTITY_VERIFIED',
    evidenceUrl: 'https://preuves.test/licence.pdf',
    notes: null,
    verifiedAt: new Date('2026-01-10T00:00:00.000Z'),
    ...partial,
  };
}

describe('Niveaux de vérification fournisseur (§16)', () => {
  it('n’affiche aucun badge sans preuve enregistrée', () => {
    expect(currentVerification([])).toBeNull();
    expect(currentVerification([record({ evidenceUrl: null })])).toBeNull();
    expect(currentVerification([record({ evidenceUrl: '   ' })])).toBeNull();
  });

  it('retient le niveau le plus élevé parmi les niveaux prouvés', () => {
    const summary = currentVerification([
      record({ id: 'a', level: 'IDENTITY_VERIFIED', verifiedAt: new Date('2026-01-10T00:00:00.000Z') }),
      record({ id: 'b', level: 'QUALITY_TESTED', verifiedAt: new Date('2026-02-01T00:00:00.000Z') }),
      record({ id: 'c', level: 'SUPPLIER_TESTED', verifiedAt: new Date('2026-03-01T00:00:00.000Z') }),
    ]);

    expect(summary?.level).toBe('QUALITY_TESTED');
    expect(summary?.evidenceUrl).toBe('https://preuves.test/licence.pdf');
    // La date affichée est celle de la preuve du niveau, la dernière vérification est la plus récente.
    expect(summary?.verifiedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(summary?.lastVerifiedAt).toBe('2026-03-01T00:00:00.000Z');
  });

  it('ignore un niveau élevé déclaré sans preuve', () => {
    const summary = currentVerification([
      record({ id: 'a', level: 'IDENTITY_VERIFIED' }),
      record({ id: 'b', level: 'PARTNER', evidenceUrl: null }),
    ]);

    expect(summary?.level).toBe('IDENTITY_VERIFIED');
  });

  it('donne toujours un libellé explicite, jamais un « vérifié » vague', () => {
    const summary = currentVerification([record({ level: 'SUPPLIER_TESTED' })]);

    expect(summary?.levelLabel).toBe('Fournisseur testé');
    expect(summary?.meaning).toContain('commande réelle');
  });

  it('classe l’historique des preuves de la plus récente à la plus ancienne', () => {
    const proofs = toProofs([
      record({ id: 'ancienne', verifiedAt: new Date('2026-01-01T00:00:00.000Z') }),
      record({ id: 'recente', verifiedAt: new Date('2026-06-01T00:00:00.000Z') }),
      record({ id: 'sans-preuve', evidenceUrl: null }),
    ]);

    expect(proofs.map((proof) => proof.id)).toEqual(['recente', 'ancienne']);
  });

  it('interdit de sauter une étape de vérification', () => {
    expect(canPromoteTo(null, 'IDENTITY_VERIFIED')).toBe(true);
    expect(canPromoteTo(null, 'SUPPLIER_TESTED')).toBe(false);
    expect(canPromoteTo('IDENTITY_VERIFIED', 'SUPPLIER_TESTED')).toBe(true);
    expect(canPromoteTo('IDENTITY_VERIFIED', 'PARTNER')).toBe(false);
    expect(canPromoteTo('QUALITY_TESTED', 'PARTNER')).toBe(true);
    // Renouvellement et rétrogradation restent possibles.
    expect(canPromoteTo('PARTNER', 'PARTNER')).toBe(true);
    expect(canPromoteTo('PARTNER', 'IDENTITY_VERIFIED')).toBe(true);
  });

  it('liste les niveaux au moins égaux à celui demandé', () => {
    expect(levelsAtLeast('QUALITY_TESTED')).toEqual(['QUALITY_TESTED', 'PARTNER']);
    expect(levelsAtLeast('IDENTITY_VERIFIED')).toHaveLength(4);
  });
});
