# Ce qui bloque réellement les importateurs

Relevé le 10 octobre 2026. Sert de base au contenu des formations, à l'assistant d'adresse
et aux pages publiques : **aucune affirmation de ces écrans ne doit sortir d'ailleurs que
d'ici**, ou d'un constat fait sur la plateforme.

## Avertissement sur les chiffres

Plusieurs chiffres circulent sur ce sujet et sont tentants à reprendre : « 75 % des
importateurs victimes de fraude », « 78 % des blocages viennent des documents », « 2 500 €
de surcoût moyen par conteneur », « 30 % des retards dus à un mauvais code SH ». Ils
viennent tous de sites commerciaux de sourcing ou de transit, et **aucun n'est sourcé**.

Ils ne sont repris nulle part dans le produit. Un pourcentage frappant et faux est pire
qu'une phrase sans chiffre : il se retient, il se répète, et il finit par être attribué à
la plateforme.

## Fraude et conditions révisées après l'acompte

Des importateurs marocains ont été dupés par deux entreprises chinoises : devis valables
dix jours, acompte de 30 % versé, puis hausse de prix réclamée et marchandise différente
de la commande. Les autorités chinoises avaient déjà reçu plusieurs plaintes contre ces
entreprises.

Les guides de transitaires décrivent le même enchaînement : un acompte de 30 à 50 %
demandé après de bons échanges initiaux, puis contrefaçon, société fictive, ou qualité
inférieure à l'échantillon.

**Dans le produit :** formation « Payer un fournisseur sans se faire avoir » (découpage du
paiement, inspection avant solde, clauses à écrire avant de verser l'acompte).

Sources : [Bladi](https://www.bladi.net/importateurs-marocains-escroques-chine,113595.html),
[MKG Mix](https://mkgmix.com/guide-achat-chine/comment-reperer-signaler-fraude-fournisseur-chinois/),
[iconomie.org](https://www.iconomie.org/fraudes-fournisseurs-chinois/)

## Documents incomplets et classification tarifaire

Les causes de blocage au dédouanement les plus souvent citées : facture commerciale, liste
de colisage ou certificat d'origine incomplets ou erronés ; non-conformité aux normes ;
erreur de classification tarifaire. Les importateurs sous-estiment par ailleurs les droits
et la TVA à l'import, négligent l'assurance transport, paient 100 % avant inspection, ou
choisissent un transitaire non spécialisé.

**Dans le produit :** formation « Coût rendu et trésorerie » (valeur déclarée, code SH,
assurance), et piège « Laisser le fournisseur choisir la description et la valeur déclarée »
dans l'assistant d'adresse.

Sources : [DocShipper](https://china.docshipper.com/fr/logistique/marchandise-bloquee-douane-chinoise/),
[Mathez Freight](https://www.mathezfreight.com/fr/blog/importer-de-chine-16-erreurs/)

## Frais qui courent au port

Un cas rapporté à Douala en avril 2025 : un conteneur mis en vente aux enchères, le
propriétaire n'ayant pas les quatorze millions de FCFA nécessaires au dédouanement, avec
des surestaries d'armateur accumulées. Un article plus ancien décrit l'encombrement du
port de Douala par des marchandises importées et non dédouanées depuis plusieurs années,
et son effet sur les délais et le coût du fret.

⚠ L'article sur la congestion est ancien (environ douze ans) : il décrit un mécanisme, pas
la situation de 2026. Il n'est cité dans le produit que pour le mécanisme — les frais
courent au jour — jamais pour un montant ou un délai actuel.

**Dans le produit :** leçon « Les frais qui courent au port », et la phrase « un dossier
incomplet se paie en jours de stationnement » sur la page d'accueil.

Sources : [AllAfrica](https://fr.allafrica.com/stories/202504150468.html),
[Investir au Cameroun](https://www.investiraucameroun.com/transport/1108-5549-la-congestion-du-port-de-douala-provoque-une-hausse-du-cout-du-fret-entre-la-chine-et-le-cameroun)

## Adresse d'expédition et code client

Le fournisseur chinois doit recevoir l'adresse **de l'entrepôt de groupage**, pas celle de
l'importateur : ce sont deux arrivées distinctes. Chaque acheteur reçoit un identifiant
unique que l'entrepôt utilise pour rattacher les colis entrants. Les informations à
transmettre au vendeur : adresse complète, nom du destinataire, téléphone, et référence
client ou de commande.

Je n'ai pas trouvé de source fiable sur le **format** exact d'un *shipping mark*, ni sur la
procédure de réclamation d'un colis perdu. Ces deux points ne sont donc traités nulle part
dans le produit : l'assistant renvoie vers l'équipe.

**Dans le produit :** assistant d'adresse (`/expedition`), et les cinq pièges de
`ADDRESS_MISTAKES` dans `@ws/contracts`.

Sources : [Sino Sourcing](https://sino-sourcing.fr/guide-1688/),
[1688 Delivery](https://1688delivery.com/fr/warehouse-service-terms),
[OrderTracker](https://www.ordertracker.com/carriers/1688)

## Ce qui reste à vérifier

- Situation réelle du port de Douala en 2026 : il faudrait la presse camerounaise récente
  ou les bulletins des organisations professionnelles, pas des sites de transitaires.
- Fourchettes de frais de dédouanement au Cameroun : les ordres de grandeur trouvés
  viennent de sites commerciaux et ne sont repris nulle part.
- Format du *shipping mark* attendu par les entrepôts avec lesquels la plateforme
  travaillera : à demander directement à chacun, et à saisir dans le champ « Consignes de
  cet entrepôt » du back-office.
