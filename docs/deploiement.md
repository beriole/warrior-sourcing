# Mise en production — Vercel et Supabase

Trois projets Vercel sur ce dépôt, une base Supabase.

| Projet Vercel | Root Directory | Adresse servie | Ce qu'il sert |
|---|---|---|---|
| `warrior-sourcing-web` | `apps/web` | `warrior-sourcing-web.vercel.app` | le site public |
| `warrior-sourcing-admin` | `apps/admin` | `warrior-sourcing-admin.vercel.app` | le back-office |
| `warrior-sourcing-api` | `apps/api` | `warrior-sourcing-api.vercel.app` | l'API NestJS, en fonction sans serveur |

Chaque projet répond **aussi** sur `<projet>-warrior-tech.vercel.app`. Les deux adresses
sont bonnes, et c'est précisément ce qui rend le réglage des origines délicat : voir plus bas.

`node scripts/poser-urls.mjs --appliquer` pose les quatre adresses d'un seul geste, dans
`apps/api/.env` et sur les trois projets. À relancer si une adresse change.

## L'API sur Vercel : ce qui a dû changer

Une API NestJS ne tourne pas telle quelle sur Vercel, et l'obstacle n'était pas théorique.

**La réconciliation des paiements était un `setInterval`.** Elle relit toutes les minutes
l'état des paiements encore ouverts chez Fapshi. Dans une fonction sans serveur, le
processus ne vit pas entre deux requêtes : l'intervalle ne se déclenche jamais. Un paiement
validé sur le téléphone serait resté « en attente » jusqu'à ce que quelqu'un ouvre la page
— et un webhook perdu n'aurait jamais été rattrapé.

Le déclencheur vient donc de l'extérieur. Deux, en réalité, parce qu'un seul ne suffit pas :

| Déclencheur | Rythme | Pourquoi |
|---|---|---|
| Cron Vercel (`apps/api/vercel.json`) | une fois par jour, à 3 h | **Le plan Hobby n'autorise pas mieux.** Toutes les minutes est refusé au déploiement, avec un message explicite. |
| Workflow GitHub (`.github/workflows/reconciliation-paiements.yml`) | toutes les cinq minutes | Gratuit, et c'est lui qui fait le vrai travail. GitHub ne garantit pas l'instant exact : c'est un filet, pas une horloge. |

Les deux appellent `GET /v1/payments/reconciliation-planifiee`, protégée par `CRON_SECRET`
et qui refuse tout le monde si le secret est absent.

Le workflow GitHub a besoin de deux secrets dans le dépôt
(*Settings → Secrets and variables → Actions*) :

| Secret | Valeur |
|---|---|
| `API_URL` | l'adresse publique de l'API, sans barre oblique finale |
| `CRON_SECRET` | la même valeur que la variable du même nom sur Vercel |

Sans eux, le workflow s'arrête proprement en disant qu'il n'a rien à faire.

**Ceci n'est pas le chemin principal.** Un paiement se confirme d'abord par le webhook
Fapshi, et pendant que le client regarde sa page, par la consultation d'état. La
réconciliation rattrape les cas où les deux ont échoué : webhook perdu, page fermée trop
tôt. Sur le plan Pro, un cron par minute remplacerait avantageusement le workflow GitHub.

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

### Trois obstacles à la construction, et comment ils se manifestent

Aucun des trois ne dit clairement ce qu'il est. Ils sont notés ici pour que la prochaine
personne ne les redécouvre pas.

**Mode interactif de Turborepo.** `turbo.json` était en `ui: "tui"`. Sur un serveur de
construction, il n'y a pas de terminal à piloter : la tâche reste suspendue sans rien
écrire. La trace s'arrête net après l'installation et ne reprend jamais — ça ressemble à
une construction lente, et c'en est une qui ne finira pas. D'où `--ui=stream`.

**Mémoire du conteneur.** La construction était tuée avec le code **137**, c'est-à-dire
tuée par le système faute de mémoire. Turborepo compilait trois paquets en parallèle sur
deux cœurs. `--concurrency=1` et un plafond de tas explicite règlent le cas.

**Constructions simultanées.** Lancer les trois déploiements en même temps renvoie
« Not authorized », ce qui laisse croire à un problème de session alors que la session est
valide. C'est la limite de constructions parallèles du plan. Déployez-les l'un après
l'autre.

## Savoir, en une requête, si la production est vraiment branchée

```bash
curl https://warrior-sourcing-api.vercel.app/v1/health
```

```json
{ "status": "ok", "database": "up", "email": "smtp", "paiements": "fapshi" }
```

Les deux derniers champs existent parce que leurs pannes sont **silencieuses** :

| Valeur | Ce qu'elle veut dire |
|---|---|
| `email: "fichier"` | aucun moyen d'envoi configuré. Les courriels sont écrits sur le disque — en sans-serveur, le disque est en lecture seule : ils sont perdus, et la table `email_log` porte `ENOENT … mkdir '/var/task/.mail'`. |
| `email: "smtp"` ou `"resend"` | les envois partent réellement. |
| `paiements: "simulation"` | impossible en production : l'API refuse désormais de démarrer sans clés Fapshi, parce qu'un encaissement simulé « réussit », active l'abonnement, et ne déplace aucun franc. |
| `paiements: "fapshi"` | l'agrégateur réel est branché. |

`MailService` lit l'utilisateur SMTP dans `SMTP_USER` **ou** `EMAIL`, et le mot de passe
dans `PASS_EMAIL` **ou** `EMAIL_PASSWORD`. Pousser `EMAIL_USER` ne sert à rien : ce nom
n'est lu nulle part.

## Les origines : le réglage qui fait tout échouer sans rien journaliser

`API_URL` est le `baseURL` de Better Auth. Pointée sur une adresse autre que celle qui
répond, elle fait émettre les cookies de session pour un hôte qui ne reçoit jamais de
requête : la session ne tient jamais, et avec elle rien de ce qui en dépend —
enregistrer une simulation, acheter une formation, lancer un paiement.

`WEB_ORIGIN` et `ADMIN_ORIGIN` acceptent **plusieurs adresses séparées par des virgules**,
et il faut s'en servir : Vercel en attribue deux par projet, et le visiteur arrivé par
celle qui n'est pas autorisée voit chacune de ses requêtes refusée **par son navigateur**.
Le serveur n'en sait rien. Il n'y a ni erreur, ni journal, ni message : seulement une
application qui ne répond pas.

Pour vérifier qu'une origine est bien acceptée :

```bash
curl -s -o /dev/null -D - -X OPTIONS https://warrior-sourcing-api.vercel.app/v1/offres/souscription   -H 'Origin: https://warrior-sourcing-web.vercel.app'   -H 'Access-Control-Request-Method: POST' | grep -i allow-origin
```

Pas d'en-tête `Access-Control-Allow-Origin` en retour : cette adresse est bloquée.

## Région d'exécution

Les trois `vercel.json` portent `"regions": ["fra1"]`. Sans ce réglage, Vercel place les
fonctions à Washington (`X-Vercel-Id: fra1::iad1::…`) alors que Supabase est à Francfort :
chaque requête traverse l'Atlantique deux fois. Mesuré depuis le Cameroun, sur une instance
tiède :

| | Washington | Francfort |
|---|---|---|
| `/v1/health`, temps serveur | 0,89 s | 0,42 s |
| page d'accueil, premier octet | 1,88 s | 0,90 s |

Le `X-Vercel-Id` est la seule façon de le vérifier : `fra1::fra1::…` est correct,
`fra1::iad1::…` veut dire que la fonction est restée aux États-Unis.

## Le téléversement : 1,4 Go ou 5 Ko

Avec un *Root Directory* réglé côté Vercel, la CLI cherche `.vercelignore` **dans ce
dossier**, pas à la racine du dépôt. Celui de la racine ne suffit donc pas : il est recopié
dans `apps/api`, `apps/web` et `apps/admin`, et les trois copies doivent rester identiques.

Sans eux, le dépôt part en entier — 1,4 Go — et le déploiement échoue sur
`File size limit exceeded (100 MB)` : les archives de `.turbo/cache` dépassent la limite.
Le message ne nomme pas le fichier.

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

## Les données de démonstration : gardées, mais présentables

Le catalogue en production est encore celui de démonstration — formations, produits et
fournisseurs portent tous le préfixe « DÉMO — ». Le choix assumé est de les garder le temps
que le vrai contenu soit saisi, et de leur donner de vraies photographies plutôt que des
rectangles de couleur (`scripts/telecharger-visuels.mjs`, puis
`scripts/poser-visuels-en-base.mjs` pour les lignes déjà en base).

**Deux exceptions, retirées parce qu'elles étaient dangereuses et non simplement fausses :**

- Les **transitaires de démonstration** sont désactivés. L'un portait une adresse d'entrepôt
  en Chine qui n'existe pas : quelqu'un pouvait y expédier de la marchandise. Six
  entreprises réelles les remplacent (`scripts/transitaires-reels.mjs`).
- Les **photos de fournisseur** pointaient vers `exemple.invalid`. Leur légende dit
  désormais qu'il s'agit d'une illustration et qu'aucune visite n'a eu lieu — la différence
  compte, parce qu'une photo de visite d'usine est un élément de vérification.

Le préfixe « DÉMO — » reste sur chaque titre, et c'est volontaire : tant qu'il est là,
personne ne peut prendre ce catalogue pour le vrai.

## Vider la base de ses données de démonstration

Les seeds écrivent des lignes fictives, toutes préfixées « DÉMO — ». En production elles
sont nuisibles, et pas seulement inutiles : l'entrepôt du transitaire de démonstration est
une adresse qui n'existe pas, et quelqu'un pourrait y expédier des marchandises.

```bash
node scripts/purger-demonstration.mjs             # n'affiche que ce qui partirait
node scripts/purger-demonstration.mjs --appliquer # supprime
```

Le script ne touche que les lignes préfixées, et laisse hors de portée les offres
d'abonnement (Gratuit, Pro, Business sont la structure commerciale, pas un jeu d'essai),
les paiements, et tout compte autre que les deux `demo-*@warrior-sourcing.cm`.

**Après la purge, le catalogue est vide.** Il n'y a pas de contournement : formations,
fournisseurs, produits, prestations, transitaires et grilles tarifaires se saisissent depuis
le back-office. Le site affiche alors ses états « rien à montrer », qui sont honnêtes ; ce
qui ne l'est pas, c'est de laisser quelqu'un payer 20 000 FCFA pour une formation
« DÉMO — » sans vidéo.

## Ce qui n'est toujours pas fait

- **Téléversement de fichiers depuis le back-office.** Photos de fournisseur et documents
  de leçon se saisissent par URL. L'API de signature Cloudinary existe
  (`apps/api/src/platform/uploads/`), le choisir-un-fichier reste à brancher.
- **File de tâches** et **limitation de débit partagée** : voir plus haut.
- **Traduction partielle.** La page d'accueil est bilingue, le reste des écrans est en
  français. Choisir l'anglais donne aujourd'hui une interface mélangée.
