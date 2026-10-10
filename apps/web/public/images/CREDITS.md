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
