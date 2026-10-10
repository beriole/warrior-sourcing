import {
  SUPPLIER_VERIFICATION_LABELS,
  SUPPLIER_VERIFICATION_RANK,
  type SupplierVerificationLevel,
} from '@ws/contracts';

/**
 * Règles des niveaux de vérification (§16).
 *
 * Deux principes, et ils ne se négocient pas :
 * 1. un badge n'existe que s'il repose sur une preuve enregistrée (`evidenceUrl` non vide) ;
 * 2. un badge s'affiche toujours avec ce qui a été contrôlé et la date du contrôle.
 *
 * Ces fonctions sont pures : elles sont testées sans base de données.
 */

/** Ligne de vérification telle qu'elle est stockée (table `supplier_verification`). */
export type VerificationRecord = {
  id: string;
  level: SupplierVerificationLevel;
  evidenceUrl: string | null;
  notes: string | null;
  verifiedAt: Date;
};

export type VerificationProof = {
  id: string;
  level: SupplierVerificationLevel;
  levelLabel: string;
  meaning: string;
  evidenceUrl: string;
  notes: string | null;
  verifiedAt: string;
};

export type VerificationSummary = {
  level: SupplierVerificationLevel;
  levelLabel: string;
  meaning: string;
  verifiedAt: string;
  lastVerifiedAt: string;
  evidenceUrl: string;
} | null;

/** Une vérification sans preuve n'est pas une preuve : elle est écartée, sans exception. */
export function provenRecords(records: readonly VerificationRecord[]): VerificationRecord[] {
  return records.filter((record) => record.evidenceUrl !== null && record.evidenceUrl.trim().length > 0);
}

/** Historique des preuves, de la plus récente à la plus ancienne. */
export function toProofs(records: readonly VerificationRecord[]): VerificationProof[] {
  return provenRecords(records)
    .slice()
    .sort((a, b) => b.verifiedAt.getTime() - a.verifiedAt.getTime())
    .map((record) => ({
      id: record.id,
      level: record.level,
      levelLabel: SUPPLIER_VERIFICATION_LABELS[record.level].label,
      meaning: SUPPLIER_VERIFICATION_LABELS[record.level].meaning,
      evidenceUrl: record.evidenceUrl as string,
      notes: record.notes,
      verifiedAt: record.verifiedAt.toISOString(),
    }));
}

/**
 * Badge à afficher : le niveau le plus élevé *prouvé*, avec la preuve qui le justifie.
 * Renvoie `null` quand aucune preuve n'existe — l'interface n'a alors aucun badge à montrer.
 */
export function currentVerification(records: readonly VerificationRecord[]): VerificationSummary {
  const proven = provenRecords(records);
  if (proven.length === 0) return null;

  const best = proven.reduce((winner, candidate) => {
    const byRank = SUPPLIER_VERIFICATION_RANK[candidate.level] - SUPPLIER_VERIFICATION_RANK[winner.level];
    if (byRank !== 0) return byRank > 0 ? candidate : winner;
    // À niveau égal, la preuve la plus récente fait foi.
    return candidate.verifiedAt > winner.verifiedAt ? candidate : winner;
  });

  const lastVerifiedAt = proven.reduce(
    (latest, record) => (record.verifiedAt > latest ? record.verifiedAt : latest),
    proven[0].verifiedAt,
  );

  return {
    level: best.level,
    levelLabel: SUPPLIER_VERIFICATION_LABELS[best.level].label,
    meaning: SUPPLIER_VERIFICATION_LABELS[best.level].meaning,
    verifiedAt: best.verifiedAt.toISOString(),
    lastVerifiedAt: lastVerifiedAt.toISOString(),
    evidenceUrl: best.evidenceUrl as string,
  };
}

/**
 * Passage d'un niveau à l'autre : on ne saute pas d'étape.
 * On ne peut devenir « Partenaire » sans avoir été testé, ni « Qualité testée » sans commande.
 * Le renouvellement d'un niveau déjà obtenu et la rétrogradation restent possibles.
 */
export function canPromoteTo(current: SupplierVerificationLevel | null, target: SupplierVerificationLevel): boolean {
  const currentRank = current === null ? 0 : SUPPLIER_VERIFICATION_RANK[current];
  return SUPPLIER_VERIFICATION_RANK[target] <= currentRank + 1;
}

/** Message d'erreur lisible quand la promotion saute une étape (§45). */
export function promotionRefusalMessage(
  current: SupplierVerificationLevel | null,
  target: SupplierVerificationLevel,
): string {
  const currentLabel = current === null ? 'aucun niveau' : SUPPLIER_VERIFICATION_LABELS[current].label;
  return `Ce fournisseur est aujourd’hui à « ${currentLabel} ». Le niveau « ${SUPPLIER_VERIFICATION_LABELS[target].label} » ne peut pas être accordé sans passer par le niveau précédent.`;
}

/** Niveaux dont le rang est supérieur ou égal à celui demandé : sert au filtre de recherche. */
export function levelsAtLeast(minimum: SupplierVerificationLevel): SupplierVerificationLevel[] {
  const floor = SUPPLIER_VERIFICATION_RANK[minimum];
  return (Object.keys(SUPPLIER_VERIFICATION_RANK) as SupplierVerificationLevel[]).filter(
    (level) => SUPPLIER_VERIFICATION_RANK[level] >= floor,
  );
}
