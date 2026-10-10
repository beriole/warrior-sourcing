/**
 * Fonction servie par Vercel.
 *
 * Volontairement vide de logique : elle réexporte le gestionnaire compilé par `nest build`.
 * Tout ce qui précède — modules, décorateurs, métadonnées — a été produit par `tsc`, qui
 * est le seul à les émettre comme NestJS les attend.
 */
export { default } from '../dist/vercel.js';
