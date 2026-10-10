# Fapshi — contrat d'intégration

Relevé le 20 septembre 2026 depuis la spécification OpenAPI officielle
(`https://docs.fapshi.com/en/api-reference/openapi.json`). À vérifier contre la documentation avant toute
modification : ce fichier évite à l'agent du lot PAY de refaire la recherche, il ne remplace pas la source.

## Accès

- Bac à sable : `https://sandbox.fapshi.com`. L'URL de production n'est pas publiée dans la spécification :
  elle vient de la configuration, jamais d'une supposition.
- Authentification par deux en-têtes : `apiuser` et `apikey`.
- Variables déjà présentes dans `apps/api/.env` : `FAPSHI_ENV`, `FAPSHI_BASE_URL`, `FAPSHI_API_USER`,
  `FAPSHI_API_KEY`, `FAPSHI_WEBHOOK_SECRET`, plus les variantes `_SANDBOX`.

## Mode d'encaissement retenu

**Paiement direct (`direct-pay`) uniquement.** La page de paiement hébergée (`initiate-pay`) n'est pas
utilisée, et l'adaptateur n'en a plus le chemin.

Pourquoi : la page hébergée sort l'utilisateur de l'application, exige une connexion assez stable pour
charger une page tierce, et n'indique pas sur quel numéro le débit partira. Le paiement direct pousse la
demande sur le téléphone du payeur, qui la valide avec son code opérateur — c'est le geste que les gens
connaissent déjà, et il fonctionne sur un réseau médiocre.

Conséquences assumées :

- le numéro à débiter est **obligatoire** dans `InitiatePaymentInput` ; un paiement sans numéro est une
  erreur de programmation, pas un repli ;
- `direct-pay` ne renvoie pas de `link`. Le champ reste au contrat et vaut `null` : l'interface sait déjà
  ne rien afficher quand il est absent ;
- l'adaptateur refuse lui-même les deux cas que Fapshi rejetterait — montant entier sous 100 FCFA, numéro
  qui n'est pas au format camerounais à neuf chiffres — pour rendre un message en français plutôt qu'une
  erreur d'agrégateur.

## Points d'entrée utilisés

| Usage | Méthode et chemin | Champs envoyés | Champs reçus |
|---|---|---|---|
| Demande de paiement sur le téléphone | `POST /direct-pay` | `amount`, `phone` ; optionnels : `medium` (`mobile money` ou `orange money`), `name`, `email`, `userId`, `externalId`, `message` | `message`, `transId`, `dateInitiated` |
| État d'une transaction | `GET /payment-status/{transId}` | — | objet transaction |
| Expiration forcée | `POST /expire-pay` | `transId` | objet transaction |
| Solde du service | `GET /balance` | — | `service`, `balance`, `currency` |
| Versement sortant | `POST /payout` | `amount` ; `phone` sauf si `medium = fapshi`, sinon `email` | `message`, `transId`, `dateInitiated` |

## Objet transaction

`transId`, `status`, `medium`, `serviceName`, `transType`, `amount`, `revenue`, `payerName`, `email`,
`redirectUrl`, `externalId`, `userId`, `webhook`, `reason`, `financialTransId`, `dateInitiated`,
`dateConfirmed`.

## Webhook

- `POST` vers l'URL configurée dans le tableau de bord Fapshi, déclenché à chaque changement d'état.
- Corps : l'objet transaction complet.
- Sécurité : en-tête `x-wh-secret`, à comparer avec `FAPSHI_WEBHOOK_SECRET`. Un webhook dont l'en-tête ne
  correspond pas est rejeté sans être traité.

**`FAPSHI_WEBHOOK_SECRET` vide rejette tout.** La comparaison échoue par construction quand la valeur
attendue est absente — c'est le bon défaut, mais il faut le savoir : tant que la variable n'est pas
renseignée **et** que la même valeur n'est pas saisie dans le tableau de bord Fapshi à côté de l'URL de
webhook, chaque notification repart en 401 et aucune n'est traitée.

### Le webhook n'est pas le seul chemin

Un paiement se confirme de trois façons, et aucune n'a besoin des deux autres :

1. **le webhook**, qui ne fait que déclencher une relecture ;
2. **la consultation** : `GET /v1/payments/{reference}` (avec session) et `GET /v1/payments/{reference}/etat`
   (sans session, pour la souscription publique) relisent l'état si la dernière vérification date d'assez
   longtemps ;
3. **la réconciliation périodique** : `PAYMENTS_RECONCILE_INTERVAL_MS` relit les paiements encore ouverts,
   avec un espacement progressif.

C'est ce qui rend le développement local possible : sans URL publique, aucun webhook n'arrive, et les
paiements se confirment quand même. La variable doit figurer dans `apps/api/src/config/env.ts` : la
validation d'environnement ne réinjecte dans le processus que les clés qu'elle connaît, donc une variable
absente du schéma est lue comme absente quoi qu'en dise `.env`.

## Correspondance avec nos états

Nos états de paiement vivent dans `@ws/contracts` (`PAYMENT_TRANSITIONS`). La traduction est la suivante :

| Fapshi | Chez nous |
|---|---|
| `CREATED` | `INITIATED` |
| `PENDING` | `PENDING` |
| `SUCCESSFUL` | `SUCCEEDED` |
| `FAILED` | `FAILED` |
| `EXPIRED` | `EXPIRED` |

Les remboursements n'existent pas côté Fapshi dans ce contrat : `REFUNDED` et `PARTIALLY_REFUNDED` restent
pilotés depuis notre back-office, avec `POST /payout` lorsqu'un remboursement doit réellement sortir.

## Règles d'implémentation

1. **Identité de la transaction** : `externalId` porte notre `Payment.reference`, `userId` porte l'identifiant
   du compte. `transId` est stocké dans `Payment.providerRef`, qui est unique : c'est ce qui rend les webhooks
   idempotents.
2. **Montants** : entiers en FCFA, minimum 100. Aucun arrondi côté client.
3. **Le webhook n'est pas une source de vérité suffisante.** Après réception, l'état est confirmé par
   `GET /payment-status/{transId}` avant d'écrire `SUCCEEDED`.
4. **Limite de débit** : 6 appels par minute et par `transId` sur l'état. La tâche de réconciliation espace ses
   vérifications en conséquence (relance progressive, pas de boucle serrée).
5. **Transitions** : toute écriture passe par `canTransitionPayment`. Un webhook rejoué qui demande une
   transition déjà faite est ignoré, pas rejeté en erreur.
6. **Interface** : le code appelle une interface `PaymentProvider`, avec une implémentation Fapshi et une
   implémentation de test. Aucun appel réseau dans les tests.

## Vérification du bac à sable

Relevée le 10 octobre 2026, contre `https://sandbox.fapshi.com` :

- `GET /balance` répond avec les clés `_SANDBOX` ;
- `POST /direct-pay` accepte une demande et renvoie un `transId` ;
- la transaction passe d'elle-même à `SUCCESSFUL` en quelques secondes — le bac à sable ne pousse rien sur
  un vrai téléphone, ce qui permet d'éprouver la chaîne complète sans déranger personne ni déplacer d'argent ;
- la souscription publique a été jouée de bout en bout sur cette base : compte créé, demande poussée, état
  relu, abonnement passé à `ACTIVE`, courriel d'identifiants parti.

En production, `direct-pay` pousse la demande sur le téléphone indiqué : une vérification de bout en bout
y débite réellement le numéro, et demande donc un accord explicite avant d'être lancée.
