# Visuels de la page d'accueil

Photographies sous **licence Unsplash** : usage commercial autorisé, sans attribution
obligatoire. Le crédit est donné ici quand même — c'est la moindre des choses, et ça
permet de retrouver l'origine d'un fichier dans six mois.

| Fichier | Sujet réel | Auteur | Source |
|---|---|---|---|
| `conteneurs-empiles.jpg` | Terminal à conteneurs vu du ciel | Ali Mkumbwa | [Unsplash](https://unsplash.com/photos/a-large-amount-of-containers-are-stacked-on-top-of-each-other-Annl9CjEaEs) |
| `port-conteneurs.jpg` | Porte-conteneurs à quai sous portiques | Nathan Cima | [Unsplash](https://unsplash.com/photos/a-large-cargo-ship-at-a-dock-MHXJ9p64Jw8) |
| `entrepot-cartons.jpg` | Entrepôt, marchandises palettisées en rayonnage | CHUTTERSNAP | [Unsplash](https://unsplash.com/photos/brown-cardboard-boxes-on-white-metal-rack-BNBA1h-NgdY) |

## Deux règles tenues ici

**Aucune légende n'affirme un lieu qui n'a pas été vérifié.** Ces photos illustrent le
transport et l'entreposage ; aucune n'est présentée comme prise en Chine ou au Cameroun,
parce que rien ne permet de l'affirmer. Une photo d'usine écartée au passage : elle
montrait une chaîne de montage dont la signalétique n'était manifestement pas chinoise.

**Aucune photo ne met en avant des personnes identifiables.** La licence Unsplash
n'autorise pas à laisser croire qu'une personne photographiée soutient un produit.

## Remplacer ces images par les vôtres

Déposez vos fichiers **sous les mêmes noms**, puis complétez ce tableau. Rien d'autre
à changer : les chemins sont déclarés dans `apps/web/src/content/visuels.ts`.

- format : JPEG ou WebP ;
- largeur : 1600 px suffit, au-delà c'est du poids pour rien sur un réseau mobile ;
- orientation : paysage pour `conteneurs-empiles` et `entrepot-cartons`, portrait pour
  `port-conteneurs`.

## Visuels des cartes — formations, produits, fournisseurs

Photographies sous **licence Pexels** : usage commercial autorisé, modification autorisée,
aucune attribution exigée. Téléchargées par `scripts/telecharger-visuels.mjs`, qui porte la
correspondance fichier → photo. Relancer le script remplace les fichiers à l'identique.

| Dossier | Ce qu'il illustre |
|---|---|
| `formations/` | le sujet de chaque formation : port, entrepôt, paiement, calcul, négociation, douane |
| `produits/` | les dix produits du catalogue de démonstration |
| `fournisseurs/` | les trois fournisseurs de démonstration |

**Trois photos ont été écartées après les avoir regardées.** Les premières trouvées pour les
écouteurs, la montre connectée et les coques montraient des AirPods, une Apple Watch et des
coques à logo Apple. Mettre du matériel Apple en face d'un prix d'achat annoncé à 38 CNY
laisse croire qu'on peut en acheter à ce prix : c'est faux, et c'est une marque déposée.
Les remplaçantes ne portent aucun logo.

Une quatrième a été refaite pour une raison bêtement visuelle : le premier cadrage de
`formations/payer.jpg` donnait un mur gris et un téléphone minuscule. Une photo ne se
choisit pas sur sa description.

### La copie dans le back-office

Les mêmes fichiers existent dans `apps/admin/public/images/`. Les visuels sont désignés en
base par un chemin relatif à la racine du site (`/images/formations/…`), et un chemin
relatif se résout contre l'application qui l'affiche. Le back-office montre les mêmes
fiches : sans la copie, il afficherait des images cassées. `telecharger-visuels.mjs` fait
la copie lui-même — ne modifiez qu'un seul des deux dossiers à la main et ils divergeront.
