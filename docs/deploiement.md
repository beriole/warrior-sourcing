# Mise en production — Vercel et Supabase

Trois projets Vercel sur ce dépôt, une base Supabase.

| Projet Vercel | Root Directory | Ce qu'il sert |
|---|---|---|
| `warrior-sourcing-web` | `apps/web` | le site public |
| `warrior-sourcing-admin` | `apps/admin` | le back-office |
| `warrior-sourcing-api` | `apps/api` | l'API NestJS, en fonction sans serveur |

## L'API sur Vercel : ce qui a dû changer

Une API NestJS ne tourne pas telle quelle sur Vercel, et l'obstacle n'était pas théorique.

**La réconciliation des paiements était un `setInterval`.** Elle relit toutes les minutes
l'état des paiements encore ouverts chez Fapshi. Dans une fonction sans serveur, le
processus ne vit pas entre deux requêtes : l'intervalle ne se déclenche jamais. Un paiement
validé sur le téléphone serait resté « en attente » jusqu'à ce que quelqu'un ouvre la page
— et un webhook perdu n'aurait jamais été rattrapé.

Le déclencheur vient donc désormais de l'extérieur : un **cron Vercel**, déclaré dans
`apps/api/vercel.json`, appelle chaque minute `GET /v1/payments/reconciliation-planifiee`.
La route est protégée par `CRON_SECRET` et refuse tout le monde si le secret est absent.

Effet de bord utile : ce rappel chaque minute garde une instance chaude. Le premier visiteur
d'une heure creuse ne paie donc pas, en général, le démarrage à froid.

**L'application est construite une fois et retenue.** Monter NestJS — modules, Prisma,
Better Auth — coûte une à trois secondes. `apps/api/src/vercel.ts` mémorise la promesse de
construction au niveau du module : une instance chaude répond sans la refaire. En cas
d'échec, la promesse est remise à zéro, pour qu'une instance ne reste pas coincée sur une
construction ratée jusqu'à son recyclage.

**La fonction est du JavaScript déjà compilé.** `api/index.js` ne fait que réexporter
`dist/vercel.js`, produit par `nest build`. L'outil de Vercel n'a ainsi pas à transformer
lui-même les décorateurs de NestJS ni à produire leurs métadonnées — ce que seul `tsc` fait
comme NestJS l'attend.

### Ce qui reste moins bon qu'un serveur qui vit

- **Démarrage à froid.** Après une longue inactivité, la première requête attend la
  construction. Le cron par minute limite le cas, il ne le supprime pas.
- **Les courriels partent dans la requête.** Un envoi lent ralentit la réponse ; un envoi
  échoué est journalisé, pas réessayé. Une file de tâches demanderait un processus qui vit.
- **La limitation de débit compte par instance.** `ThrottlerModule` garde son compteur en
  mémoire : avec dix instances, la limite réelle est multipliée par dix. Il faut un
  stockage Redis pour que le plafond annoncé soit le plafond appliqué.

## 1. Supabase

Deux URL, et elles ne sont pas interchangeables.

| Variable | Port | Usage |
|---|---|---|
| `DATABASE_URL` | **6543** (`?pgbouncer=true`) | l'application |
| `DIRECT_URL` | **5432** | les migrations |

Supabase sert l'application par PgBouncer en mode transaction : chaque requête peut tomber
sur une connexion différente. C'est exactement ce qu'il faut sous le sans-serveur, où
chaque instance froide ouvre la sienne — et c'est impossible pour une migration, qui pose
des verrous et crée des types sur une session qu'elle doit garder ouverte.

Prisma 7 a retiré `directUrl` du schéma et de `prisma.config.ts`. Le choix se fait donc à
la lecture : `prisma.config.ts` prend `DIRECT_URL` quand elle existe, `DATABASE_URL` sinon.
Ce fichier ne configure que l'outil en ligne de commande ; l'application lit
`DATABASE_URL` par son propre adaptateur.

### Le piège qui coûte une soirée

La chaîne copiée depuis Supabase contient `[YOUR-PASSWORD]`, **crochets compris**. Collée
telle quelle, elle produit :

```
password authentication failed for user "postgres"
```

Le message parle de l'utilisateur, le problème est le mot de passe. Remplacez
`[YOUR-PASSWORD]` par le mot de passe de la base — crochets supprimés — dans les deux URL.
Le mot de passe se retrouve dans Supabase, *Project Settings → Database*.

Si votre mot de passe contient `@`, `/`, `?`, `#`, `[` ou `]`, encodez-les
(`@` → `%40`, et ainsi de suite) : sans quoi l'URL se découpe au mauvais endroit.

### Migrations

```bash
pnpm --filter @ws/api exec prisma migrate deploy
```

`deploy`, jamais `dev` : `dev` est interactif et peut proposer de réinitialiser la base.
Les migrations créent `pg_trgm` et `unaccent`, dont dépend la recherche tolérante aux
fautes. Supabase les autorise.

Elles tournent aussi à chaque construction de l'API sur Vercel
(`buildCommand` de `apps/api/vercel.json`) : la base suit le code qu'on déploie.

## 2. Les trois projets Vercel

```bash
npm install -g vercel
vercel login
```

Puis, pour chaque application, depuis son dossier :

```bash
cd apps/api   && vercel link && vercel --prod
cd apps/web   && vercel link && vercel --prod
cd apps/admin && vercel link && vercel --prod
```

Chaque `vercel.json` porte déjà sa commande de construction, qui remonte à la racine et
passe par Turborepo : sans cela, `@ws/ui` et `@ws/contracts` ne sont pas compilés et la
construction échoue sur des imports introuvables.

### Variables d'environnement

```bash
node scripts/vercel-env.mjs api --dry   # voir ce qui partirait
node scripts/vercel-env.mjs api         # pousser
```

Le script lit `apps/api/.env`, n'affiche jamais une valeur, et refuse de pousser une
variable qui contient encore un texte de modèle. Il travaille par liste blanche : votre
`.env` local contient des réglages de développement qui n'ont rien à faire en production.

`node scripts/preparer-production.mjs` pose au préalable ce qui peut l'être sans rien
demander : `AUTH_SECRET`, `CRON_SECRET`, `AUTH_COOKIE_SAMESITE` et `OPENROUTER_MODEL`. Il
ne remplace jamais une valeur déjà choisie et sauvegarde le fichier avant d'écrire.

### Le réglage qui casse l'authentification si on l'oublie

`AUTH_COOKIE_SAMESITE=none`.

Le site et l'API seront sur deux domaines distincts — et même deux sous-domaines de
`vercel.app` comptent comme deux sites, parce que `vercel.app` figure sur la liste des
suffixes publics. Le navigateur ne joint alors le cookie de session qu'avec
`SameSite=None; Secure`.

Avec `lax`, **chaque requête part sans session et rien ne le signale** : pas d'erreur, pas
de message, seulement un utilisateur qui semble déconnecté en permanence.

Servir l'API sur un sous-domaine de votre propre domaine — `api.votre-domaine.cm` avec le
site sur `votre-domaine.cm` — permet de revenir à `lax`, qui est plus sûr.

### Après le premier déploiement

Vercel attribue les adresses au premier déploiement. Il faut ensuite les réinjecter, puis
redéployer :

| Variable | Valeur |
|---|---|
| `API_URL`, sur le projet API | l'adresse du projet API |
| `WEB_ORIGIN`, `ADMIN_ORIGIN`, `APP_URL`, sur le projet API | les adresses du site et du back-office |
| `NEXT_PUBLIC_API_URL`, sur le site et le back-office | l'adresse du projet API |

`WEB_ORIGIN` et `ADMIN_ORIGIN` sont la liste blanche CORS : une adresse inexacte et le
navigateur bloque toutes les requêtes, sans que le serveur voie quoi que ce soit.

## 3. Fapshi

1. Tableau de bord Fapshi → URL de webhook :
   `https://<projet-api>.vercel.app/v1/payments/webhook`
2. Le secret du tableau de bord doit être **identique** à `FAPSHI_WEBHOOK_SECRET`. Vide ou
   différent des deux côtés, chaque notification repart en 401.
3. `FAPSHI_ENV` décide des clés employées : `sandbox` prend les clés `_SANDBOX`, `live`
   prend les autres. En `live`, chaque essai pousse une demande sur un vrai téléphone.

Même sans webhook, un paiement finit par être confirmé : la consultation d'état et le cron
de réconciliation s'en chargent. Le webhook accélère, il n'est pas le seul chemin.

## 4. Premier compte administrateur

Les comptes naissent `CLIENT`. Depuis l'éditeur SQL de Supabase :

```sql
update "user" set role = 'SUPER_ADMIN' where email = 'votre@adresse';
```

Puis, depuis le back-office, saisissez vos transitaires et leurs grilles tarifaires : sans
eux, le calculateur n'a aucun tarif et l'assistant d'adresse n'a aucune adresse à proposer.

## Ce qui n'est toujours pas fait

- **Téléversement de fichiers depuis le back-office.** Photos de fournisseur et documents
  de leçon se saisissent par URL. L'API de signature Cloudinary existe
  (`apps/api/src/platform/uploads/`), le choisir-un-fichier reste à brancher.
- **File de tâches** et **limitation de débit partagée** : voir plus haut.
- **Traduction partielle.** La page d'accueil est bilingue, le reste des écrans est en
  français. Choisir l'anglais donne aujourd'hui une interface mélangée.
