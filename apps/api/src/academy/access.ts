import { LOCK_REASON_LABELS, type CourseAccess, type LockReason } from '@ws/contracts';

/**
 * Règles de droit d'accès à une formation (ACA-02, §54).
 *
 * Fonctions pures, testées unitairement : la décision ne dépend d'aucune requête, et le
 * service ne peut pas l'oublier. Le principe tient en une phrase : seule l'existence d'une
 * inscription ouvre un contenu payant, et l'interface ne fait que reproduire ce que le
 * serveur a déjà refusé.
 */

/** Décision d'accès. Quand elle est refusée, elle dit pourquoi, avec le libellé du contrat. */
export type AccessDecision =
  | { allowed: true; reason: null; message: null }
  | { allowed: false; reason: LockReason; message: string };

const ALLOWED: AccessDecision = { allowed: true, reason: null, message: null };

function denied(reason: LockReason): AccessDecision {
  return { allowed: false, reason, message: LOCK_REASON_LABELS[reason] };
}

/**
 * Droit d'accès au contenu d'une formation.
 *
 * - une inscription enregistrée ouvre tout, quelle que soit son origine ;
 * - sans session, rien ne s'ouvre : il faut un compte pour enregistrer une progression ;
 * - une formation gratuite s'ouvre dès qu'un compte est connecté (l'inscription est créée
 *   à la première ouverture, avec l'origine `FREE_COURSE`) ;
 * - une formation **incluse dans l'abonnement** s'ouvre pour qui dispose du droit
 *   `ACADEMY_INCLUDED` ; l'inscription est créée à la première ouverture, avec l'origine
 *   `SUBSCRIPTION`, et disparaîtra donc pas à l'expiration — mais le droit, lui, est
 *   recalculé à chaque lecture pour toutes les formations qu'il n'a pas encore ouvertes ;
 * - une formation **payante** reste fermée tant qu'aucune inscription n'existe. Un
 *   abonnement ne l'ouvre pas : c'est un achat distinct, et l'étiquette de la fiche le dit.
 *
 * `academyIncluded` est le droit réellement porté par l'abonnement en cours, relu à chaque
 * appel. Il n'est jamais déduit d'un nom d'offre.
 */
export function courseAccess(args: {
  access: CourseAccess;
  signedIn: boolean;
  enrolled: boolean;
  academyIncluded?: boolean;
}): AccessDecision {
  if (args.enrolled) return ALLOWED;
  if (!args.signedIn) return denied('SIGN_IN_REQUIRED');
  if (args.access === 'FREE') return ALLOWED;
  if (args.access === 'SUBSCRIPTION' && args.academyIncluded) return ALLOWED;
  return denied(args.access === 'PAID' ? 'PURCHASE_REQUIRED' : 'SUBSCRIPTION_REQUIRED');
}

/**
 * Droit d'accès à une leçon : l'extrait offert est lisible par tout le monde, le reste
 * suit le droit de la formation.
 */
export function lessonAccess(args: {
  access: CourseAccess;
  signedIn: boolean;
  enrolled: boolean;
  preview: boolean;
  academyIncluded?: boolean;
}): AccessDecision {
  if (args.preview) return ALLOWED;
  return courseAccess(args);
}

/**
 * Droit de téléchargement d'une ressource de la bibliothèque.
 * Une ressource libre est ouverte à tous ; une ressource rattachée à une formation suit
 * le droit de cette formation.
 */
export function resourceAccess(args: {
  free: boolean;
  course: { access: CourseAccess } | null;
  signedIn: boolean;
  enrolled: boolean;
  academyIncluded?: boolean;
}): AccessDecision {
  if (args.free) return ALLOWED;
  if (!args.course) {
    // Ressource réservée sans formation de rattachement : seul un compte connecté y accède.
    return args.signedIn ? ALLOWED : denied('SIGN_IN_REQUIRED');
  }
  return courseAccess({
    access: args.course.access,
    signedIn: args.signedIn,
    enrolled: args.enrolled,
    academyIncluded: args.academyIncluded,
  });
}
