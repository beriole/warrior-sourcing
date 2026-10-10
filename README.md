# Warrior Sourcing

Plateforme d'accompagnement à l'importation Chine → Cameroun.
Spécification : [Cahier_des_charges_Import_Chine_Cameroun.pdf](Cahier_des_charges_Import_Chine_Cameroun.pdf).

## Structure

| Dossier | Rôle |
|---|---|
| `apps/web` | Site client, Next.js (App Router), mobile d'abord, FR/EN via next-intl. Port 3000 |
| `apps/admin` | Back-office, Next.js. Port 3001 |
| `apps/api` | API NestJS (REST + OpenAPI), Prisma, PostgreSQL. Port 4000 |
| `packages/contracts` | Schémas Zod, énumérations métier et calculs partagés (coût rendu, ROI…) |
| `packages/ui` | Design system : tokens de la charte + composants shadcn/ui personnalisés |
| `packages/emails` | Design system email et templates transactionnels (React Email) |
| `packages/tsconfig` | Configurations TypeScript communes |

## Démarrage

Prérequis : Node ≥ 20.19, pnpm 12, PostgreSQL ≥ 16 installé localement.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # puis renseignez le mot de passe PostgreSQL
pnpm db:create      # crée la base warrior_sourcing si elle n'existe pas
pnpm db:migrate     # applique apps/api/prisma/schema.prisma
pnpm dev            # web :3000, admin :3001, api :4000
```

Aucun conteneur n'est utilisé, ni en développement ni en production : le site part sur Vercel,
l'API sur un hébergeur Node (Railway, Render, VPS) avec une base PostgreSQL gérée.
Redis ne sera nécessaire qu'à l'arrivée des files de tâches (BullMQ).

Documentation de l'API : http://localhost:4000/docs (JSON : `/docs/openapi.json`).

## Commandes

| Commande | Effet |
|---|---|
| `pnpm build` | Compile tout le monorepo |
| `pnpm typecheck` | Vérifie les types |
| `pnpm lint` | ESLint (web, admin), oxlint (api) |
| `pnpm test` | Tests unitaires (contracts, api) |
| `pnpm --filter @ws/api test:e2e` | Tests de bout en bout de l'API |
| `pnpm db:create` | Crée la base PostgreSQL indiquée dans `DATABASE_URL` |
| `pnpm db:studio` | Explorateur de la base |
| `pnpm generate:api` | Régénère le contrat OpenAPI et le client typé du site |

## Authentification

Connexion par adresse email et code à 6 chiffres (Better Auth monté sur `/v1/auth`).
Le mot de passe reste réservé à l'équipe interne.

| Route | Rôle |
|---|---|
| `POST /v1/auth/email-otp/send-verification-otp` | Envoie le code par email (10 minutes, 3 tentatives) |
| `POST /v1/auth/sign-in/email-otp` | Vérifie le code, crée le compte au besoin, ouvre la session |
| `GET /v1/me` | Utilisateur connecté et état de son onboarding |
| `GET /v1/me/profile/options` | Questions de l'onboarding |
| `PUT /v1/me/profile` | Enregistre le profil d'importateur (§10) |
| `GET /v1/dashboard` | Activité, commande la plus urgente et prochaine action (§11) |

Écrans correspondants : [/connexion](apps/web/src/app/connexion/page.tsx),
[/onboarding](apps/web/src/app/onboarding/page.tsx) et
[/tableau-de-bord](apps/web/src/app/(app)/tableau-de-bord/page.tsx).

Les écrans connectés partagent la coque [app-shell.tsx](apps/web/src/components/app-shell.tsx) :
sidebar sur bureau (§49), barre du bas à cinq entrées sur mobile (§48).
La prochaine action recommandée est calculée côté serveur par
[next-action.ts](apps/api/src/dashboard/next-action.ts), pour rester identique partout.

**Envoi réel par SMTP** : le code part par email via le compte configuré (`SMTP_HOST`, `EMAIL`, `PASS_EMAIL`).
Si une clé `RESEND_API_KEY` est ajoutée, elle prend le dessus. Sans configuration, les emails sont écrits
dans `apps/api/.mail` et le code reste lisible dans les logs.

En production, `AUTH_SECRET` doit être une valeur aléatoire (`openssl rand -base64 48`).

## Contrat API

Le front n'écrit plus d'appels à la main : il consomme un client généré depuis le contrat OpenAPI.

1. Les réponses sont décrites une seule fois, en Zod, dans [packages/contracts/src/api.ts](packages/contracts/src/api.ts).
2. Les contrôleurs typent leur retour avec ces schémas et les publient via `@ApiOkResponse`.
3. `pnpm generate:api` écrit [apps/api/openapi.json](apps/api/openapi.json) puis génère
   `apps/web/src/api/` : des hooks TanStack Query typés.

Le dossier généré ne se modifie jamais à la main. Le transport, lui, est écrit :
[api-fetcher.ts](apps/web/src/lib/api-fetcher.ts) porte le cookie de session et transforme une erreur
de l'API en `ApiError` avec son `code` stable.

L'intégration continue ([.github/workflows/ci.yml](.github/workflows/ci.yml)) régénère le contrat et
échoue si le résultat diffère de ce qui est commité : le contrat ne peut pas dériver du code.

## Notifications email

Les templates vivent dans [packages/emails/src/templates/](packages/emails/src/templates/) et sont déclarés
dans [registry.ts](packages/emails/src/registry.ts). Envoi depuis n'importe quel service de l'API :

```ts
await this.mail.send({ to: user.email, template: 'payment-confirmed', data: { orderReference, amount } });
```

| Commande | Effet |
|---|---|
| `pnpm --filter @ws/emails preview` | Génère `.preview/index.html` : tous les templates, tous les jeux de données |
| `pnpm --filter @ws/api email:send welcome` | Envoie un email de test à `MAIL_TEST_RECIPIENT` |
| `GET /v1/dev/emails` | Liste des templates (développement uniquement) |
| `GET /v1/dev/emails/:key?fixture=…` | Aperçu HTML dans le navigateur |

Ordre des transports : `RESEND_API_KEY` si elle existe, sinon SMTP (`SMTP_HOST`, `EMAIL`, `PASS_EMAIL`), sinon écriture dans `apps/api/.mail`.
Chaque envoi, réussi ou échoué, est journalisé dans la table `email_log`.

### Ajouter un type d'email

1. Créer `packages/emails/src/templates/mon-email.tsx` : un schéma Zod (avec valeurs par défaut),
   une fonction `subject()` et un composant qui assemble les composants existants.
2. L'ajouter au registre avec au moins un jeu de données de démonstration.

Prévisualisation, envoi, version texte et tests le prennent alors en compte automatiquement.

### Règles des emails

- **Aucune image distante** : tous les visuels sont dessinés en HTML/CSS, donc rien à débloquer.
- **Les animations sont un bonus** : l'état visible est l'état final, `prefers-reduced-motion` est respecté.
- **Chaque dégradé a une couleur de repli** pour Outlook.
- **Réutiliser les composants** de `packages/emails/src/components/` avant d'en créer un nouveau.

## Règles du projet

Elles découlent des principes non négociables du cahier des charges (§54).

- **Argent** : toujours des entiers en unités mineures (1 FCFA = 1). Jamais de `Float`. Une conversion de devise enregistre son taux, sa date et sa source.
- **Provenance** : chaque chiffre affiché est marqué comme donnée vérifiée, estimation ou suggestion IA (`ProvenanceBadge`). Une estimation n'est jamais présentée comme une garantie.
- **Badges fournisseurs** : uniquement les quatre niveaux de `SUPPLIER_VERIFICATION_LEVELS`, avec preuve et date.
- **Paiements** : transitions d'état limitées à `PAYMENT_TRANSITIONS`, webhooks idempotents via `providerRef`.
- **Logique métier** : dans l'API ou dans `@ws/contracts`, jamais dans les apps Next.js. Les droits sont vérifiés côté serveur.
- **Énumérations** : `schema.prisma` et `@ws/contracts` doivent garder les mêmes valeurs.
- **Design system d'abord** : réutiliser `@ws/ui` avant de créer un composant. Utiliser les tokens sémantiques (`primary`, `surface`…) plutôt que les couleurs brutes.
- **Mobile** : penser Android d'entrée de gamme. Animations courtes, désactivables (`prefers-reduced-motion` ou `data-motion="reduced"`), skeletons plutôt que spinners.
