# Mise en production

Trois applications, et elles ne vont pas au même endroit.

| Application | Où | Pourquoi |
|---|---|---|
| `apps/web` (site) | **Vercel** | Next.js, rendu à la demande. C'est le cas d'usage de Vercel. |
| `apps/admin` (back-office) | **Vercel**, projet séparé | Même technologie, mais un domaine distinct : le back-office n'a rien à faire sur l'adresse publique. |
| `apps/api` (NestJS) | **Pas Vercel.** Railway, Render, Fly.io, ou un VPS. | Voir ci-dessous. |

## Pourquoi l'API ne va pas sur Vercel

Ce n'est pas une préférence, ce sont trois incompatibilités concrètes :

1. **La réconciliation des paiements est un `setInterval`.** Elle relit l'état des
   paiements encore ouverts toutes les minutes. Une fonction sans serveur s'arrête à la fin
   de sa requête : l'intervalle ne tourne jamais. Sans webhook public **et** sans
   réconciliation, un paiement validé sur le téléphone n'est jamais confirmé.
2. **Prisma et le pool de connexions.** Chaque instance froide ouvre sa propre connexion à
   PostgreSQL. Sous charge, on épuise les connexions avant d'épuiser le CPU. Il faudrait
   un pooler (PgBouncer, Prisma Accelerate) rien que pour y survivre.
3. **Better Auth lit le corps brut des requêtes** et est monté avant l'analyse JSON
   d'Express. C'est faisable derrière un adaptateur sans serveur, mais chaque mise à jour
   devient une occasion de le casser silencieusement.

Un hébergeur qui exécute un processus Node en continu règle les trois d'un coup.

## 1. Base de données

PostgreSQL **16 ou plus**, avec les extensions `pg_trgm` et `unaccent` (la recherche
tolérante aux fautes en dépend). Neon, Supabase et Railway les fournissent.

```bash
pnpm --filter @ws/api exec prisma migrate deploy
pnpm --filter @ws/api run db:seed   # facultatif : données de démonstration
```

`migrate deploy`, jamais `migrate dev` : `dev` est interactif et peut proposer de
réinitialiser la base.

## 2. API

```bash
pnpm install --frozen-lockfile
pnpm turbo run build --filter=@ws/api
node apps/api/dist/main.js
```

Variables à renseigner — la liste complète commentée est dans `apps/api/.env.example` :

| Variable | Valeur en production |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URL PostgreSQL |
| `APP_URL` | adresse publique du site, utilisée dans les courriels |
| `API_URL` | adresse publique de l'API |
| `WEB_ORIGIN`, `ADMIN_ORIGIN` | origines autorisées par CORS, **exactement** |
| `AUTH_SECRET` | `openssl rand -base64 48` |
| `AUTH_COOKIE_SAMESITE` | **`none`** si le site et l'API ne sont pas sur le même domaine |
| `RESEND_API_KEY` ou SMTP | sans quoi les courriels s'écrivent dans un dossier |
| `FAPSHI_*` | voir `docs/integrations/fapshi.md` |
| `PAYMENTS_RECONCILE_INTERVAL_MS` | `60000` |
| `CLOUDINARY_URL` | dépôt des vidéos et des documents |

### Le réglage qui casse l'authentification si on l'oublie

`AUTH_COOKIE_SAMESITE`. En local, le site et l'API partagent `localhost` : `lax` suffit.
En production, dès que le site est sur un domaine et l'API sur un autre, le navigateur ne
joint le cookie de session qu'avec `SameSite=None; Secure`.

Avec `lax`, **chaque requête part sans session, et rien ne le signale** : pas d'erreur, pas
de message, seulement un utilisateur qui semble déconnecté en permanence. C'est le genre de
panne qui coûte une journée. `none` impose HTTPS, exigence du navigateur et non de ce code.

Le plus simple reste de servir l'API sur un sous-domaine du site — `api.votre-domaine.cm`
avec le site sur `votre-domaine.cm` — et de garder `lax` : deux sous-domaines du même
domaine enregistrable ne sont pas « cross-site ».

## 3. Site et back-office sur Vercel

Deux projets Vercel distincts, tous deux sur ce dépôt :

| Réglage | `apps/web` | `apps/admin` |
|---|---|---|
| Root Directory | `apps/web` | `apps/admin` |
| Framework | Next.js (détecté) | Next.js (détecté) |
| Build / Install | lus dans `vercel.json` | lus dans `vercel.json` |

La commande de construction remonte à la racine et passe par Turborepo, pour que `@ws/ui`
et `@ws/contracts` soient compilés avant l'application. Sans cela, la construction échoue
sur des imports introuvables.

Variable à définir sur les deux projets :

```
NEXT_PUBLIC_API_URL=https://api.votre-domaine.cm
```

`NEXT_PUBLIC_` est un préfixe qui **inscrit la valeur dans le JavaScript envoyé au
navigateur**. N'y mettre jamais autre chose qu'une adresse publique.

## 4. Après le premier déploiement

Dans l'ordre, parce que chacun dépend du précédent :

1. **Webhook Fapshi.** Tableau de bord Fapshi → URL `https://api.votre-domaine.cm/v1/payments/webhook`,
   et le secret **identique** à `FAPSHI_WEBHOOK_SECRET`. Vide des deux côtés, chaque
   notification repart en 401.
2. **Un compte administrateur.** Les comptes naissent `CLIENT`. Le promouvoir en base :
   `UPDATE "user" SET role = 'SUPER_ADMIN' WHERE email = '...';`
3. **Les transitaires et leurs grilles**, depuis le back-office. Sans eux, le calculateur
   n'a aucun tarif et l'assistant d'adresse n'a aucune adresse à faire copier.
4. **Vérifier un paiement de bout en bout** avec un petit montant réel : le bac à sable
   confirme tout seul, la production attend une validation sur un vrai téléphone.

## Ce qui n'est pas prêt

- **Pas de file de tâches.** Les courriels partent dans la requête. Un envoi lent ralentit
  la réponse ; un envoi échoué est journalisé, pas réessayé. `REDIS_URL` et BullMQ sont
  prévus, pas branchés.
- **Limitation de débit en mémoire.** `ThrottlerModule` compte par instance. Au-delà d'une
  instance, la limite réelle est multipliée par leur nombre : il faut le stockage Redis.
- **Téléversement non branché au back-office.** Les images de fournisseur et les documents
  de leçon se saisissent par URL. L'API de signature Cloudinary existe
  (`apps/api/src/platform/uploads/`) ; le choisir-un-fichier dans le back-office reste à
  faire.
- **Traduction partielle.** La page d'accueil est bilingue ; le reste des écrans est en
  français. Choisir l'anglais donne aujourd'hui une interface mélangée.
