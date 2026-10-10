# Plan d'exécution par agents

Objectif : livrer les 83 tâches de [taches.md](taches.md) avec plusieurs agents IA, sans gaspiller de contexte
ni créer de collisions. Établi le 20 septembre 2026.

---

## 1. Principe de découpage

**Un agent prend un lot entier, pas une tâche.** Chaque démarrage d'agent repart d'un contexte vide : lui faire
découvrir le dépôt coûte cher. Un agent qui enchaîne `CAT-01` → `CAT-07` amortit cette découverte une seule fois.

**Trois agents en parallèle au maximum.** Au-delà, les relectures s'empilent et deux agents finissent par toucher
les mêmes fichiers. Les lots d'une même vague sont choisis pour ne partager aucun fichier.

**Les points de contact sont explicites.** Deux paquets seulement sont communs : `@ws/contracts` (valeurs métier)
et `@ws/ui` (composants). Un agent qui doit y ajouter quelque chose le signale dans son rapport ; personne d'autre
ne touche à ces fichiers pendant la vague.

---

## 2. Discipline de contexte

Règles à copier dans chaque brief. Elles divisent la consommation par deux ou trois.

1. **Ne pas explorer le dépôt.** Le brief donne la liste exacte des fichiers à lire. Un agent qui croit devoir lire
   autre chose le demande au lieu de parcourir l'arborescence.
2. **Lire le strict nécessaire** : la section 2 de `taches.md` (règles communes), sa propre section de lot, et les
   fichiers listés. Pas le cahier des charges entier, pas les 9 templates d'email pour en écrire un.
3. **Ne pas relire un fichier déjà écrit** pour vérifier : l'outil d'édition échoue si l'écriture a raté.
4. **Une seule capture d'écran par écran livré**, et seulement pour un écran visuel.
5. **Pas de boucle de vérification** : `pnpm build && pnpm typecheck && pnpm lint && pnpm test` une fois à la fin,
   puis correction des erreurs signalées. Pas de relance tant que rien n'a changé.
6. **Rapport final court** : ce qui est livré, ce qui reste, ce qui a été ajouté à `@ws/contracts` ou `@ws/ui`,
   les questions ouvertes. Cinq lignes suffisent.
7. **Tâche bloquée = tâche rendue**, avec la raison. Un agent ne devine jamais un format d'API, une clé, un tarif.

---

## 3. Vagues

Chaque vague se termine par une relecture et une fusion avant d'ouvrir la suivante.

### Vague 0 — Fondations (1 agent, court)

| Lot | Tâches | Pourquoi d'abord |
|---|---|---|
| AUTH | AUTH-01, AUTH-03 | La connexion par email remplace le SMS : tout ce qui suppose un compte en dépend |
| PLAT | PLAT-04, PLAT-01, PLAT-02 | Erreurs homogènes, client API généré, intégration continue : chaque tâche suivante en profite |

`AUTH-02` attend la clé d'envoi (DEC-03).

### Vague 1 — Cœur métier (3 agents en parallèle)

| Agent | Lot | Tâches | Fichiers propres |
|---|---|---|---|
| A | CARGO + CALC | CARGO-01, CARGO-02, CARGO-03, CARGO-05, CALC-01, CALC-02, CALC-04, CALC-05 | `packages/contracts/src/calculator.ts`, `apps/api/src/cargo/`, `apps/api/src/calculator/`, `apps/web/src/app/(app)/calculateur/` |
| B | CAT | CAT-01 à CAT-07 | `apps/api/src/catalog/`, `apps/web/src/app/(app)/opportunites/` |
| C | SUP | SUP-01, SUP-02, SUP-03, SUP-05 | `apps/api/src/suppliers/`, `apps/web/src/app/(app)/fournisseurs/` |

`CALC-03` (taux datés) et `SUP-04` (protection des coordonnées) attendent respectivement PLAT-07 et SUB-01.

### Vague 2 — Transaction et logistique (3 agents)

| Agent | Lot | Tâches | Prérequis |
|---|---|---|---|
| D | ORD + PAY | ORD-01 à ORD-05, PAY-01, PAY-02 | Documentation et clés Fapchi |
| E | LOG | LOG-01 à LOG-05 | PLAT-06 pour les preuves d'inspection |
| F | PLAT | PLAT-06, PLAT-07, PLAT-03 | Clé Cloudinary |

### Vague 3 — Contenu et pilotage (3 agents)

| Agent | Lot | Tâches |
|---|---|---|
| G | ACA | ACA-01 à ACA-05 |
| H | ADM + CARGO | ADM-01 à ADM-08, CARGO-04 (écrans de gestion des transitaires et des tarifs) |
| I | SRV + PLAT | SRV-01, SRV-02, PLAT-08, PLAT-09 |

### Vague 4 — Fidélisation (3 agents)

| Agent | Lot | Tâches |
|---|---|---|
| J | LAB | LAB-01, LAB-02, LAB-03 |
| K | SUB + PRO | SUB-01, SUB-02, SUP-04, PRO-01, PRO-02 |
| L | NOT + MSG | NOT-01, NOT-02, MSG-01, MSG-02 |

### Vague 5 — Intelligence et finitions (3 agents)

| Agent | Lot | Tâches |
|---|---|---|
| M | CONF + AI | CONF-01, AI-01, AI-02 |
| N | COM | COM-01, AUT-01 |
| O | PLAT + QUA | PLAT-10, PLAT-11, PLAT-12, QUA-01 à QUA-06 |

**Total : 16 agents**, répartis sur 6 vagues.

---

## 4. Modèle de brief

À remplir pour chaque agent. Court volontairement : tout le reste est dans le dépôt.

```
Lot : <ID> — <nom>
Tâches : <liste d'identifiants>

Lis, dans cet ordre, et rien d'autre :
1. docs/taches.md — sections 1, 2 et ta section de lot
2. <3 à 6 fichiers du dépôt, chemins exacts>

Contraintes :
- Respecte les 10 règles communes (section 2 de taches.md).
- Ne modifie aucun fichier hors de : <liste de dossiers>.
- Un ajout dans @ws/contracts ou @ws/ui doit être signalé dans ton rapport.
- Migrations : un sujet par tâche.

Fini quand : les critères « fait quand » de chaque tâche sont remplis, et que
pnpm build && pnpm typecheck && pnpm lint && pnpm test passent.

Rapport attendu : 5 lignes — livré, restant, ajouts partagés, blocages.
```

---

## 5. Portes de validation

Entre deux vagues, le coordinateur vérifie :

1. Les commandes du monorepo passent sur la branche fusionnée.
2. Aucun chiffre affiché sans provenance ni date.
3. Aucune route protégée sans garde serveur.
4. Les nouveaux composants sont dans `@ws/ui`, pas dupliqués dans une app.
5. Les migrations s'appliquent sur une base vierge.

Une vague ne s'ouvre pas tant que la précédente n'est pas fusionnée : c'est ce qui évite les conflits coûteux.

---

## 6. Ce qui manque pour démarrer

| Vague | Bloqué par | À fournir |
|---|---|---|
| 0 | AUTH-02 | Clé Resend, ou mot de passe d'application Gmail pour `berioletsague@gmail.com` |
| — | PAY-01 | Rien : clés Fapshi en place, contrat d'API consigné dans [integrations/fapshi.md](integrations/fapshi.md) |
| — | PLAT-06 | Rien : `CLOUDINARY_URL` en place |
| — | CARGO | Rien pour construire. Les vrais tarifs se saisissent ensuite depuis l'administration, transitaire par transitaire |
| 5 | PLAT-12 | Nom de domaine — reporté, déploiement sur URL d'hébergeur en attendant |

Les vagues 0 et 1 peuvent démarrer sans rien attendre, à l'exception de `AUTH-02`.
