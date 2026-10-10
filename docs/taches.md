# Backlog de développement — Warrior Sourcing

Référence : [Cahier_des_charges_Import_Chine_Cameroun.pdf](../Cahier_des_charges_Import_Chine_Cameroun.pdf) (55 sections, notées §n ci-dessous).
Ce document liste **tout ce qui reste à construire**, découpé en lots assignables à des agents distincts.

- Une tâche = un périmètre livrable, testable, et qui ne marche pas sur les plates-bandes d'un autre lot.
- Les identifiants (`CAT-03`, `PAY-01`…) servent à assigner et à référencer dans les commits et les PR.
- « Dépend de » indique ce qui doit exister avant de commencer. Le reste est parallélisable.

---

## 1. État actuel : ce qui existe déjà

À ne pas refaire. Lire ces fichiers avant d'écrire du code.

| Domaine | Livré | Points d'entrée |
|---|---|---|
| Monorepo | pnpm + Turborepo, 3 apps, 4 paquets | [README.md](../README.md) |
| Design system | Tokens de la charte, composants (Button, Card, Badge, Progress, Skeleton, ProvenanceBadge, VerificationBadge, Money) | `packages/ui/src/` |
| Règles métier partagées | Devises et montants, provenance des données, états de paiement, niveaux fournisseur, étapes logistiques, onboarding, rôles, calcul du coût rendu | `packages/contracts/src/` |
| Emails | Design system email + 9 templates + prévisualisation + `MailService` (Resend / fichier) + journal `email_log` | `packages/emails/`, `apps/api/src/mail/` |
| Authentification | Better Auth, **email + code à 6 chiffres** (DEC-02), rôles serveur, gardes `@Roles` / `@StaffOnly` | `apps/api/src/auth/` |
| Onboarding | 4 questions (§10), API + écran | `apps/api/src/onboarding/`, `apps/web/src/components/onboarding-flow.tsx` |
| Tableau de bord | Activité, commande urgente, prochaine action calculée côté serveur (§11) | `apps/api/src/dashboard/`, `apps/web/src/components/dashboard/` |
| Accueil public | Hero, piliers, boucle, simulateur express (§9) | `apps/web/src/app/page.tsx` |
| Calcul | Coût rendu, marge, ROI, seuil de rentabilité + `POST /v1/calculator/landed-cost` | `packages/contracts/src/calculator.ts` |
| Base | Schéma éclaté par lot, migrations appliquées | `apps/api/prisma/schema/*.prisma` |
| Coque connectée | Sidebar bureau (§49), barre du bas mobile (§48) | `apps/web/src/components/app-shell.tsx` |
| Academy | Catalogue, fiche, lecteur de leçon, quiz, progression, notes, bibliothèque (ACA-01 à ACA-05) | `apps/api/src/academy/`, `apps/web/src/components/academy/` |
| Services | Catalogue des 10 prestations, commande, paiement réutilisant le lot PAY, suivi d'exécution et livrables (SRV-01, SRV-02) | `apps/api/src/services/`, `apps/web/src/components/services/` |
| Profil et compte | Écran de profil, modification du nom et du numéro, déconnexion, choix de la langue, aide (PRO-01 partiel, AUTH-03) | `apps/web/src/components/profil/`, `apps/web/src/components/parametres/` |
| Prix et promotions | Moteur de remises (pourcentage, montant, prix promotionnel, gratuité) sur formations et abonnements, codes, quotas, fenêtres de validité | `packages/contracts/src/promotions.ts`, `apps/api/src/billing/`, `apps/admin/src/app/promotions/` |
| Abonnements | Offres Gratuit / Pro / Business éditables, droits vérifiés côté serveur, paiement par le lot PAY, **souscription sans compte** avec identifiants engendrés à la confirmation du paiement (SUB-01) | `packages/contracts/src/subscriptions.ts`, `apps/api/src/billing/subscription-activation.service.ts`, `apps/api/src/auth/account-provisioning.ts`, `apps/web/src/components/abonnement/` |
| Page d'accueil | Entonnoir complet : héros, chiffres relevés du catalogue, piliers, **offres de formation avec leurs prix**, simulateur, **offres d'abonnement avec leurs prix**, boucle, confiance, premier geste, pied en colonnes | `apps/web/src/app/page.tsx`, `apps/web/src/components/accueil/` |
| Mouvement | Vocabulaire CSS fermé (masque, flou, carte, surtitre, interface, barre, pouls, dérive, flottement, tracé, glissement), révélation au défilement en une seule passe, avancement de lecture lié au défilement réel, tout sous `prefers-reduced-motion` | `packages/ui/src/styles/motion.css`, `packages/ui/src/motion/` |
| Achat de formation | Achat à l'unité avec ou sans compte, prix et promotion décidés par le même moteur que l'abonnement, inscription ouverte à la confirmation du paiement (SUB-02) | `apps/api/src/academy/course-purchase.service.ts`, `apps/web/src/components/academy/course-purchase-panel.tsx` |
| Assistant d'adresse | Code client, bloc d'adresse de l'entrepôt chinois prêt à coller, et les cinq erreurs qui coûtent le plus cher (CARGO-03) | `packages/contracts/src/shipping-address.ts`, `apps/api/src/cargo/shipping-address.service.ts`, `apps/web/src/components/expedition/` |
| Fournisseurs (back-office) | Création d'une fiche, visuel, photos datées et signées, boutiques en ligne (ADM-04) | `apps/api/src/admin/admin-suppliers.service.ts`, `apps/admin/src/components/fournisseurs/` |
| Contenus de leçon | Vidéo Cloudinary et documents attachés depuis le back-office (ADM-05) | `apps/api/src/admin/admin-academy.service.ts`, `apps/admin/src/components/formations/` |
| Messagerie | Conversations par guichet, messages, pièces jointes, non-lus, clôture par l'équipe (MSG-01) | `apps/api/src/messaging/`, `apps/web/src/components/messages/`, `apps/admin/src/app/messages/` |
| Business Lab | Projets commerciaux, saisie des ventes, indicateurs constatés et récupération du capital (LAB-01, LAB-02) | `packages/contracts/src/business-lab.ts`, `apps/api/src/business-lab/` |
| Exploitation | Paiements en lecture seule et état des intégrations dans le back-office | `apps/api/src/admin/admin-payments.service.ts`, `apps/admin/src/app/paiements/` |
| Recherche et favoris | Recherche unifiée tolérante aux fautes (`pg_trgm` + `unaccent`) et favoris idempotents, bouton réutilisable (PLAT-08, PLAT-09) | `apps/api/src/platform/search/`, `apps/api/src/platform/favorites/`, `packages/ui/src/components/favorite-button.tsx` |
| Mouvement | Entrées CSS (`ws-mask`, `ws-card`, `ws-onview`…), révélation au défilement une seule fois, grille et étapes animées, compteurs | `packages/ui/src/motion/`, `packages/ui/src/styles/motion.css` |
| Back-office | Tableau de bord, utilisateurs et rôles, commandes, litiges, transitaires et tarifs, produits (ADM-03), fournisseurs et niveaux (ADM-04), **formations et bibliothèque (ADM-05)** | `apps/api/src/admin/`, `apps/admin/src/` |

---

## 2. Règles communes à tous les agents

Non négociables (§54). Une PR qui les enfreint est refusée.

1. **Argent** : entiers en unités mineures (1 FCFA = 1). Jamais de `Float`, jamais de `parseFloat` sur un montant. Toute conversion de devise enregistre son taux, sa date et sa source.
2. **Provenance** : chaque chiffre affiché est marqué `VERIFIED`, `ESTIMATE` ou `AI_SUGGESTION` (`ProvenanceBadge`). Une estimation n'est jamais présentée comme une garantie.
3. **Aucune statistique inventée.** Pas de faux avis, pas de fausse urgence, pas de compteur décoratif. Un module sans données renvoie une liste vide et l'interface affiche un état vide qui explique pourquoi (§45).
4. **Droits côté serveur.** Toute route protégée utilise `AuthGuard` + `@Roles(...)`. L'interface ne fait que masquer ce que le serveur refuse déjà.
5. **Design system d'abord.** Réutiliser `@ws/ui` avant de créer un composant. Un nouveau composant générique va dans `@ws/ui`, pas dans l'app.
6. **Énumérations partagées.** Toute valeur métier vit dans `@ws/contracts` et doit rester identique dans `schema.prisma`.
7. **Mobile d'abord.** Android d'entrée de gamme : zones tactiles ≥ 44 px, skeletons plutôt que spinners, animations courtes et désactivables.
8. **Tests.** Toute règle de calcul ou de transition d'état a un test unitaire. Toute route a un test e2e (au moins : cas nominal, accès refusé, donnée invalide).
9. **Langue.** Toute l'interface et les messages d'erreur en français, sans jargon technique exposé à l'utilisateur.
10. **Migrations** : `pnpm --filter @ws/api prisma migrate dev --name <sujet>`, un sujet par PR.

### Conventions de collaboration

- Une branche par tâche : `lot/<ID>-<résumé>` (exemple `cat/CAT-03-fiche-produit`).
- Ne pas modifier les fichiers d'un autre lot. Un besoin transverse passe par `@ws/contracts` ou `@ws/ui`, annoncé au coordinateur.
- `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` doivent passer avant toute PR.
- Les décisions ouvertes (§ 9 de ce document) ne se tranchent pas seul.

---

## 3. Décisions bloquantes à prendre (coordinateur)

Ces choix conditionnent des lots entiers. Tant qu'ils ne sont pas tranchés, les agents travaillent avec le repli existant.

Mise à jour du 20 septembre 2026.

| ID | Décision | État | Conséquence |
|---|---|---|---|
| DEC-01 | Agrégateur Mobile Money | **Tranchée : Fapshi, clés en place** | Lot PAY débloqué. Contrat d'API relevé dans [integrations/fapshi.md](integrations/fapshi.md) |
| DEC-02 | Canal des codes de connexion | **Tranchée : email, pas de SMS** | La connexion par téléphone est remplacée par une connexion par email (lot AUTH) |
| DEC-03 | Envoi réel des emails | **En attente** : aucune clé, aucun domaine vérifié | Expéditeur générique vers l'adresse propriétaire uniquement ; sinon écriture dans `apps/api/.mail` |
| DEC-04 | Stockage fichiers | **Tranchée : Cloudinary, clé en place** (`CLOUDINARY_URL`) | Couvre aussi la vidéo, donc remplace DEC-05 |
| DEC-05 | Hébergement vidéo | **Absorbée par DEC-04** | L'Academy utilise Cloudinary (vidéo + images) |
| DEC-06 | Nom de marque et domaine | **Reportée** (budget) | Pas de domaine, pas d'identité de marque dans les emails ; déploiement sur URL d'hébergeur |
| DEC-08 | Fournisseur des fonctions IA | **Tranchée : OpenRouter**, clé en place (`OPENROUTER_API_KEY`) | L'assistant (§30) et les analyses passent par une seule passerelle, le modèle reste changeable sans toucher au code |
| DEC-07 | Barèmes de transport et taxes | **Saisis par l'administrateur** | Plus de barème figé dans le code : le lot CARGO donne un CRUD complet des transitaires et de leurs tarifs |

### Précisions

- **Fapshi** : contrat d'API, correspondance des états et règles d'idempotence consignés dans [integrations/fapshi.md](integrations/fapshi.md). Les clés sont dans `apps/api/.env` (`FAPSHI_*`). L'adaptateur passe par une interface `PaymentProvider` avec une implémentation de test.
- **Emails** : aucun élément de marque pour l'instant. Expéditeur neutre, destinataire de test `berioletsague@gmail.com`. Deux chemins possibles au choix du coordinateur : une clé Resend, ou un envoi SMTP par compte Gmail avec mot de passe d'application (AUTH-02).
- **Barèmes** : ordres de grandeur relevés le 20/09/2026 pour amorcer la table, à confirmer auprès de transitaires camerounais : maritime conteneur 20 pieds ≈ 2 000 à 4 500 USD, 40 pieds ≈ 2 600 à 5 500 USD ; aérien ≈ 3,4 USD/kg en période de pointe ; délais 35 à 45 jours en conteneur complet, jusqu'à 50 jours en groupage, la plupart des routes passant par un port de transbordement. Ces valeurs ne sont jamais affichées sans la mention « estimation » ni sans leur date.

---

## 4. Phase 1 — MVP (§51)

### Lot PLAT — Plateforme et fondations

Transverse : à traiter tôt, car les autres lots s'appuient dessus.

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| PLAT-01 | Client API typé généré depuis OpenAPI (Orval) + hooks TanStack Query | — | `pnpm generate:api` produit le client ; le tableau de bord l'utilise à la place de `apiFetch` |
| PLAT-02 | Intégration continue GitHub Actions : build, typecheck, lint, tests, migrations sur base éphémère | — | La CI passe sur une PR de test |
| PLAT-03 | Jeu de données de démonstration (`prisma/seed.ts`) : 1 compte client, 1 staff, 10 produits, 8 fournisseurs, 3 formations, 2 commandes | CAT-01, SUP-01 | `pnpm db:seed` remplit une base vide et l'app est navigable |
| PLAT-04 | Gestion d'erreurs API homogène : filtre d'exception, codes stables, messages français, aucun détail technique exposé | — | Tout échec renvoie `{ message, code, issues? }` ; test e2e sur 400/401/403/404/429 |
| PLAT-05 | Journalisation et observabilité : Sentry (API + web), logs structurés, `AuditLog` sur actions sensibles | — | Une erreur provoquée remonte dans Sentry ; une action admin crée une ligne d'audit |
| PLAT-06 | Uploads Cloudinary : signature côté serveur, contrôle type/taille, transformations d’images, vidéo pour l’Academy | DEC-04 | `POST /v1/uploads` accepte une image ≤ 5 Mo et refuse un exécutable ; test e2e |
| PLAT-07 | Files de tâches BullMQ + Redis : relance des paiements en attente, envoi d'emails asynchrone, expiration OTP | DEC-01 | Une tâche planifiée s'exécute et se voit dans un tableau de bord de file |
| PLAT-08 | Recherche globale (§36) : `pg_trgm` + `unaccent`, endpoint unifié produits / fournisseurs / formations / services, tolérance aux fautes | CAT-01, SUP-01, ACA-01 | « telefone » remonte « téléphone » ; test unitaire sur la tolérance |
| PLAT-09 | Favoris (§36) : table, endpoints, bouton réutilisable dans `@ws/ui` | CAT-01 | Ajout/retrait persistant, visible dans le profil |
| PLAT-10 | Application installable (PWA) : manifeste, service worker Serwist, écran hors-ligne | — | Installable sur Android ; la coque s'affiche sans réseau |
| PLAT-11 | Internationalisation : compléter `next-intl` (FR/EN) sur tous les écrans livrés, sélecteur de langue | — | Aucun texte en dur hors fichiers de messages |
| PLAT-12 | Déploiement : Vercel (web, admin) + hébergeur Node (API) + base gérée, variables d'environnement documentées | DEC-06 | Une URL de préproduction répond, migrations appliquées automatiquement |

### Lot AUTH — Connexion par email (DEC-02)

Remplace la connexion par SMS déjà construite. À traiter avant tout ce qui suppose un compte réel.

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| AUTH-01 | Bascule vers le code à 6 chiffres par email (plugin `emailOTP` de Better Auth), retrait du plugin téléphone, migration du schéma, écran `/connexion` adapté | — | Un compte se crée et se reconnecte par email ; tests e2e mis à jour ; le numéro devient une donnée de profil facultative |
| AUTH-02 | Transport d'envoi réel : Resend avec clé, ou SMTP Gmail avec mot de passe d'application ; expéditeur neutre, sans élément de marque | DEC-03 | Un code arrive réellement dans la boîte `berioletsague@gmail.com` |
| AUTH-03 | Nom et email dans l'onboarding, envoi de l'email de bienvenue au bon destinataire | AUTH-01 | Le profil porte un vrai nom ; l'email de bienvenue part à l'inscription |

### Lot CAT — Produits et opportunités (§12, §13, §14)

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| CAT-01 | Modèle de données produit : produit, images, catégorie, prix Chine, poids/volume, MOQ, badges, points de vigilance, fournisseurs liés | — | Migration + seed minimal ; valeurs d'énumération dans `@ws/contracts` |
| CAT-02 | Données de marché : prix local observé (valeur, date, source interne), demande, concurrence, risque, capital, facilité de transport | CAT-01 | Chaque donnée porte sa date et sa provenance ; jamais affichée sans date |
| CAT-03 | API catalogue : liste paginée, onglets (Pour vous, Tendances, Nouveautés, Faible budget, Forte marge, Faible concurrence), filtres (budget, MOQ, marge, risque, poids, catégorie, transport) | CAT-01 | Test e2e par onglet et par filtre ; tri stable |
| CAT-04 | Personnalisation « Pour vous » : croisement avec `ImporterProfile` (budget, catégories) | CAT-03 | Deux profils différents obtiennent deux listes différentes ; test unitaire de la règle |
| CAT-05 | Écran Opportunités : onglets, filtres, cartes compactes (image, prix Chine, coût rendu estimé, prix local observé, marge potentielle, demande, risque), badges non trompeurs | CAT-03 | Mobile d'abord, skeletons, état vide explicite |
| CAT-06 | Fiche produit (§13) : galerie, vidéo, coûts estimés, fourchette de prix local datée, marge et hypothèses affichées, points de vigilance, fournisseurs associés, CTA « Simuler mon investissement » | CAT-02 | Chaque chiffre porte son badge de provenance |
| CAT-07 | Simulateur d'investissement (§14) : budget → quantité, investissement, coût rendu unitaire, CA potentiel, marge, ROI, seuil, avertissement | CALC-01 | Résultats identiques à ceux de l'API ; test unitaire sur 3 scénarios |

### Lot CARGO — Transitaires et tarifs (§20, §37)

Le propriétaire doit pouvoir gérer lui-même ses transitaires et leurs grilles tarifaires, sans redéploiement.

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| CARGO-01 | Modèle transitaire : nom, contact, villes desservies, modes servis, actif ou non, notes | — | Migration ; valeurs d'énumération dans `@ws/contracts` |
| CARGO-03 | Assistant d'adresse d'expédition : entrepôt chinois saisi en back-office, code client stable, pièges documentés | CARGO-01 | Fait. Rien n'est engendré : un transitaire sans adresse n'est pas proposé |
| CARGO-02 | Modèle grille tarifaire : mode (aérien, maritime, express), unité (kg ou m³), prix unitaire, minimum facturé, palier de poids, délai annoncé, devise, date d'entrée en vigueur, source | CARGO-01 | Un tarif garde sa date et son auteur ; l'historique des prix est conservé |
| CARGO-03 | API CRUD réservée à l'administration : création, édition, désactivation, historique, recherche | CARGO-02 | Réservé aux rôles `ADMIN` et `SUPER_ADMIN` ; test e2e d'accès refusé pour un client |
| CARGO-04 | Écrans d'administration : liste des transitaires, formulaire de tarifs, activation, duplication d'une grille | CARGO-03, ADM-01 | Un transitaire et ses tarifs se créent en moins de deux minutes, sans toucher au code |
| CARGO-05 | Branchement au calculateur : choix du transitaire, tarif appliqué, mention « estimation », date et source du tarif affichées | CARGO-02, CALC-01 | Le résultat indique quel tarif a servi et depuis quand il est valable |

### Lot CALC — Calculateur d'importation (§20, §21)

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| CALC-01 | Extension du moteur : poids/dimensions/cartons, poids volumétrique, mode aérien/maritime/express, transport interne Chine, inspection, packaging, assurance, fret, service, taxes estimatives, coûts personnalisés | — | Tests unitaires sur chaque poste et sur le poids volumétrique |
| CALC-02 | Reprise des tarifs saisis dans le lot CARGO, avec repli sur des fourchettes marquées « estimation » quand aucun transitaire n'est renseigné | CARGO-02 | Aucun tarif codé en dur ne subsiste |
| CALC-03 | Taux de change datés : source, rafraîchissement quotidien, affichage « taux du JJ/MM » | PLAT-07 | Une simulation stocke le taux utilisé |
| CALC-04 | Écran calculateur complet : formulaire par étapes, résultat lisible en quelques secondes, comparaison aérien vs maritime côte à côte | CALC-01 | Mobile d'abord ; total visible sans défilement sur un écran de 360 px |
| CALC-05 | Sauvegarde et partage d'une simulation (lien, reprise, duplication) | CALC-04 | Une simulation sauvegardée se retrouve dans le profil |

### Lot SUP — Fournisseurs (§15, §16, §17, §18, §19)

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| SUP-01 | Modèle fournisseur complet : profil usine, produits, conditions, documents, incidents, commandes test, photos réelles | — | Migration ; coordonnées isolées dans un champ protégé |
| SUP-02 | Niveaux de vérification (§16) : historique des preuves, date de dernière vérification, workflow de promotion d'un niveau à l'autre | SUP-01 | Impossible d'afficher un badge sans preuve enregistrée ; test e2e |
| SUP-03 | Recherche et filtres fournisseurs : produit, catégorie, ville, MOQ, personnalisation, échantillon, niveau de vérification | SUP-01 | Test e2e par filtre |
| SUP-04 | Protection et monétisation (§17) : aperçu public, coordonnées réservées selon l'offre, paywall explicatif, jamais de masquage des risques | SUB-01 | Un compte gratuit ne reçoit jamais les coordonnées, même via l'API brute ; test e2e |
| SUP-05 | Écrans fournisseurs : liste, carte, profil détaillé, CTA devis / sourcing | SUP-03 | Mobile d'abord ; badges explicites |
| SUP-06 | Sourcing personnalisé (§18) : dossier (nom, photos, lien, quantité, budget, qualité, logo, packaging, destination, date), timeline à 6 étapes, messagerie liée | MSG-01 | Un dossier suit son cycle complet ; test e2e |
| SUP-07 | Comparateur (§19) : critères homogènes (prix, MOQ, qualité, délai, personnalisation, paiement, échantillon, livraison entrepôt, vérification, incidents), sélection d'une proposition | SUP-06 | Comparaison de 3 offres sur mobile sans perte d'information |

### Lot ORD — Commandes, précommandes et paiement (§22, §23, §24)

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| ORD-01 | Modèle commande : lignes, quantités, montants, ville, mode de réception, téléphone, références | CAT-01 | Migration + calcul du total côté serveur uniquement |
| ORD-02 | Checkout court et local (§23) : produit, quantité, ville, réception, téléphone, résumé complet des frais avant paiement | ORD-01 | Parcours réalisable en moins d'une minute sur mobile |
| PAY-01 | Intégration Fapchi derrière une interface `PaymentProvider` : initiation, webhook idempotent, réconciliation des paiements en attente, remboursement partiel | DEC-01, PLAT-07 | Machine à états respectée (`PAYMENT_TRANSITIONS`) ; test e2e avec webhook rejoué |
| PAY-02 | Aucune donnée de carte stockée : tout passe par le prestataire, vérification documentée | PAY-01 | Revue de sécurité écrite dans `docs/` |
| ORD-03 | Confirmation de commande (§24) : animation légère, numéro, résumé, prochaine étape, CTA suivi, reçu téléchargeable | PAY-01 | Email `payment-confirmed` + `order-confirmed` déclenchés |
| ORD-04 | Précommandes (§22) : campagne, progression réelle, date de fin, contenu inclus/non inclus, FAQ, avis, CTA participer | ORD-01 | Aucune urgence artificielle ; la progression reflète des participations réelles |
| ORD-05 | Reçus PDF et historique des commandes côté client | ORD-03 | Un reçu se télécharge et correspond au paiement |

### Lot LOG — Logistique et suivi (§25, §38)

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| LOG-01 | Événements logistiques : enregistrement par étape avec date, heure, description, preuve éventuelle | ORD-01 | Les 13 étapes de `@ws/contracts` sont utilisables ; test e2e |
| LOG-02 | Écran de suivi client : timeline, carte stylisée Chine → Cameroun, photos et documents quand ils existent | LOG-01 | Aucune fausse géolocalisation ; réutilise la carte SVG de l'accueil |
| LOG-03 | Notifications de changement d'étape : email `shipment-update`, notification interne | LOG-01, NOT-01 | Un changement d'étape déclenche exactement un envoi |
| LOG-04 | Vue opérationnelle agents (§38) : colonnes par statut, filtres, actions groupées, code/QR unique par colis | LOG-01 | Un agent traite 20 colis sans quitter l'écran |
| LOG-05 | Inspection (§38) : photos, vidéo, quantité, défauts, packaging, mesures, poids, résultat conforme / réserve / non conforme, rapport envoyé au client | PLAT-06, LOG-04 | Le rapport est consultable par le client et archivé |

### Lot ACA — Academy (§26)

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| ACA-01 | Modèle formations : cours, chapitres, leçons, ressources, quiz, niveaux, formateurs, prix | — | Migration + seed |
| ACA-02 | Lecteur vidéo Cloudinary : lecture adaptative, reprise, progression enregistrée, accès protégé aux vidéos payantes | DEC-04 | Une vidéo payante n'est pas lisible sans droit ; test e2e |
| ACA-03 | Écrans Academy : reprendre la dernière leçon, catalogue par niveau et thème, fiche cours (trailer, programme, durée, avis, prix) | ACA-01 | Mobile d'abord |
| ACA-04 | Quiz et suivi de progression, notes personnelles, documents téléchargeables | ACA-02 | La progression alimente l'email `course-progress` |
| ACA-05 | Bibliothèque : PDF, guides, checklists, modèles, fiches pratiques | PLAT-06 | Recherche et filtres fonctionnels |

### Lot SRV — Services (§29)

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| SRV-01 | Catalogue de prestations : recherche fournisseur, vérification, inspection, négociation, achat assisté, paiement fournisseur, consolidation, transport, branding, accompagnement | — | Chaque service porte prix, délai, livrables, conditions |
| SRV-02 | Commande d'un service : formulaire, paiement, suivi d'exécution, livrables | PAY-01 | Test e2e complet |

### Lot ADM — Back-office (§37, §39, §40)

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| ADM-01 | Coque admin : navigation, tableaux TanStack Table, filtres, actions groupées | — | Réutilise `@ws/ui` |
| ADM-02 | KPIs réels (§37) : CA, commandes, clients, précommandes, services, sourcing, paiements | ORD-01, PAY-01 | Aucun chiffre calculé côté client |
| ADM-03 | Gestion produits et analyses | CAT-01 | Création, édition, publication, retrait |
| ADM-04 | Gestion fournisseurs et niveaux de vérification | SUP-02 | Promotion d'un niveau exige une preuve |
| ADM-05 | Gestion formations et ressources | ACA-01 | — |
| ADM-06 | Gestion commandes et logistique | LOG-04 | — |
| ADM-07 | Utilisateurs, rôles, tickets, notifications | PLAT-05 | Changement de rôle journalisé |
| ADM-08 | Litiges (§39) : ouverture, analyse, preuves, contact fournisseur, proposition, résolution, clôture, journal d'audit complet | PLAT-05 | Un litige suit le workflow sans raccourci possible |

---

## 5. Phase 2 (§52)

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| LAB-01 | Business Lab (§27) : projet commercial, capital, quantité, coût total, saisie progressive des ventes | LOG-01 | Migration + écrans |
| LAB-02 | Indicateurs : CA, stock restant, marge, ROI, progression de récupération du capital, « il reste N unités à vendre » | LAB-01 | Calcul dans `@ws/contracts`, testé |
| LAB-03 | Import Stories (§28) : publication avec consentement, choix des données publiques, badge de vérification seulement si contrôle réel | LAB-02 | Aucune publication sans consentement enregistré |
| SUB-01 | Abonnements (§43) : offres Gratuit / Pro / Business, droits associés, paywall explicatif | PAY-01 | Les droits sont vérifiés côté serveur |
| SUB-02 | Achat ponctuel d'accès : formation à l'unité, avec ou sans compte | SUB-01 | Fait pour les formations. L'accès ponctuel aux coordonnées d'un fournisseur reste à faire (SUP-04) |
| SUB-03 | Souscription sans compte : compte créé au paiement, mot de passe engendré **à la confirmation** et envoyé une seule fois, aucune réinitialisation pour une adresse déjà connue | SUB-01 | Fait. Idempotence du webhook éprouvée ; le mot de passe rendu est vérifié par une vraie connexion |
| NOT-01 | Notifications (§33) : modèle, catégories, préférences par canal, centre de notifications, anti-spam | PLAT-07 | Une préférence désactivée bloque réellement l'envoi |
| NOT-02 | Notifications push (PWA) et emails critiques | AUTH-02, PLAT-10 | — |
| MSG-01 | Messagerie (§32) : conversations Support / Sourcing / Logistique / Formation, pièces jointes, statuts de lecture, rattachement à une commande | PLAT-06 | Historique conservé ; test e2e |
| MSG-02 | Temps réel (Socket.IO + adaptateur Redis) | MSG-01 | Message reçu sans rechargement, sur deux instances |
| PRO-01 | Profil complet (§34) : informations, sécurité, paiements, adresses, préférences, documents, abonnement | SUB-01 | — |
| PRO-02 | Gamification (§35) : badges liés à des actions réelles uniquement | LAB-01 | Aucun badge sur métrique artificielle |

---

## 6. Phase 3 (§53)

| ID | Tâche | Dépend de | Fait quand |
|---|---|---|---|
| CONF-01 | Centre conformité (§31) : recherche par produit, documents nécessaires, restrictions, certifications, date de mise à jour, renvoi vers l'autorité compétente | — | Toute information incertaine est signalée comme à confirmer |
| AI-01 | Assistant contextuel (§30) : comprend budget, catégorie, historique et page courante ; oriente vers produits, formations, calculateur, fournisseurs, services | CAT-04 | Les réponses distinguent données vérifiées et suggestions ; aucune promesse de bénéfice |
| AI-02 | Comparaison intelligente et analyse de marché | CAT-02 | Basées sur des données réelles collectées |
| COM-01 | Communauté | — | — |
| AUT-01 | Automatisations (relances, recommandations déclenchées par événement) | NOT-01 | — |

---

## 7. Qualité, sécurité et performance (transverse, continu)

| ID | Tâche | Fait quand |
|---|---|---|
| QUA-01 | Sécurité (§41) : limitation de débit par route sensible, protection brute-force, rotation des tokens, contrôle des fichiers, sauvegardes, revue écrite | Revue consignée dans `docs/securite.md` |
| QUA-02 | Accessibilité (§46) : contrastes, navigation clavier, libellés, information jamais portée par la couleur seule | Audit sur les 10 écrans principaux |
| QUA-03 | Performance (§46) : budget JS par page, images optimisées, chargement différé, pagination, cache, découpage du code | Page d'accueil < 150 ko de JS ; test Lighthouse mobile ≥ 90 |
| QUA-04 | Tests de bout en bout Playwright sur les parcours critiques : connexion, onboarding, simulation, commande, paiement, suivi | La CI les exécute à chaque PR |
| QUA-05 | Microcopy (§45) : relecture de tous les états vides, erreurs et CTA | Aucun code technique visible par l'utilisateur |
| QUA-06 | Conformité légale : conditions d'utilisation, protection des données personnelles, mentions sur les estimations | Pages publiées et liées dans le pied de page |

---

## 8. Ordre de démarrage recommandé

Trois agents peuvent démarrer immédiatement, sans se gêner :

| Agent | Lot de départ | Pourquoi |
|---|---|---|
| Agent 1 | `CALC-01` → `CALC-04` | Ne dépend d'aucune donnée à collecter, utile seul, valorise le travail déjà fait |
| Agent 2 | `CAT-01` → `CAT-03` | Débloque le tableau de bord, la recherche, les favoris et le seed |
| Agent 3 | `SUP-01` → `SUP-03` | Indépendant du catalogue jusqu'à `CAT-06` |

Ensuite, selon les décisions prises : `PAY-01` (après DEC-01), `ACA-02` (après DEC-05), `LOG-05` (après DEC-04).

`PLAT-01`, `PLAT-02` et `PLAT-04` gagnent à être traités en parallèle par un quatrième agent : ils réduisent le coût de toutes les tâches suivantes.

---

## 9. Récapitulatif

| Phase | Lots | Tâches |
|---|---|---|
| Phase 1 (MVP) | AUTH (3), PLAT (12), CAT (7), CARGO (5), CALC (5), SUP (7), ORD + PAY (7), LOG (5), ACA (5), SRV (2), ADM (8) | 66 |
| Phase 2 | LAB (3), SUB (2), NOT (2), MSG (2), PRO (2) | 11 |
| Phase 3 | CONF (1), AI (2), COM (1), AUT (1) | 5 |
| Transverse | QUA (6) | 6 |
| **Total** | | **88 tâches, 5 décisions tranchées sur 7** |
