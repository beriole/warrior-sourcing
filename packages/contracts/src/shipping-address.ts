import { z } from 'zod';

/**
 * Assistant d'adresse d'expédition (§25, CARGO-03).
 *
 * Le problème qu'il traite est banal et coûteux : un importateur donne à son fournisseur
 * chinois sa propre adresse camerounaise, ou l'adresse de l'entrepôt **sans son code
 * client**. Dans le premier cas la marchandise part en express à un tarif qui n'a rien à
 * voir avec ce qui était prévu ; dans le second, le carton arrive à l'entrepôt sans que
 * personne sache à qui il appartient.
 *
 * Choix de fond : **rien n'est engendré**. L'adresse vient du transitaire saisi en
 * back-office, le code client vient du compte. Un assistant qui improviserait une adresse
 * enverrait une marchandise nulle part — et c'est exactement le genre de texte qu'un
 * modèle de langue produit sans effort et sans remords.
 */

/**
 * Un champ du bloc d'adresse, avec son nom tel que le fournisseur le verra et ce qu'il
 * faut y mettre. `critique` marque les champs dont l'absence fait perdre le colis.
 */
export const AddressFieldSchema = z.object({
  /** Intitulé du champ sur le formulaire du vendeur, en chinois quand c'est celui-là. */
  label: z.string(),
  /** Traduction de l'intitulé, pour s'y retrouver. */
  labelFr: z.string(),
  /** Ce qu'il faut recopier, exactement. */
  value: z.string(),
  /** Pourquoi ce champ compte, en une phrase. */
  why: z.string(),
  critique: z.boolean(),
});
export type AddressField = z.infer<typeof AddressFieldSchema>;

export const ShippingAddressSchema = z.object({
  forwarderId: z.string(),
  forwarderName: z.string(),
  warehouseName: z.string(),
  /** Modes de transport que ce transitaire sert réellement. */
  modes: z.array(z.enum(['SEA', 'AIR', 'EXPRESS'])),
  modeLabels: z.array(z.string()),
  cities: z.array(z.string()),
  fields: z.array(AddressFieldSchema),
  /**
   * Bloc prêt à coller, tel quel, dans la conversation avec le fournisseur.
   * Construit par le serveur : l'écran ne le recompose pas, sinon les deux divergeraient.
   */
  copyBlock: z.string(),
  /** Consignes propres à cet entrepôt, saisies par l'administration. Vide si aucune. */
  instructions: z.string().nullable(),
});
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

/** Une erreur courante, et ce qu'elle coûte. Aucune n'est inventée : voir docs/recherche. */
export const AddressMistakeSchema = z.object({
  titre: z.string(),
  consequence: z.string(),
  aFaire: z.string(),
});
export type AddressMistake = z.infer<typeof AddressMistakeSchema>;

export const ShippingAddressResponseSchema = z.object({
  /** Code client du compte, engendré à la première demande puis stable. */
  clientCode: z.string(),
  /**
   * Entrepôts disponibles. Vide quand aucun transitaire n'a d'adresse saisie : l'écran le
   * dit alors franchement au lieu de montrer un formulaire sans contenu.
   */
  addresses: z.array(ShippingAddressSchema),
  mistakes: z.array(AddressMistakeSchema),
});
export type ShippingAddressResponse = z.infer<typeof ShippingAddressResponseSchema>;

/**
 * Les erreurs les plus coûteuses, dans l'ordre où elles surviennent.
 *
 * Elles viennent de situations documentées, pas d'intuitions : adresse personnelle donnée
 * au vendeur, colis sans code client, documents incomplets au dédouanement. Les sources
 * sont citées dans `docs/recherche/importateurs.md`. Aucun pourcentage n'est repris : ceux
 * qui circulent sur ce sujet viennent de sites commerciaux et ne sont pas sourcés.
 */
export const ADDRESS_MISTAKES: AddressMistake[] = [
  {
    titre: 'Donner votre adresse au Cameroun au fournisseur',
    consequence:
      'Le vendeur expédie en express international. Le coût n’a plus rien à voir avec un groupage, et la marchandise échappe au circuit prévu.',
    aFaire:
      'Donnez toujours l’adresse de l’entrepôt en Chine. Votre adresse camerounaise ne sert qu’à la livraison finale, après dédouanement.',
  },
  {
    titre: 'Oublier le code client sur le colis',
    consequence:
      'Le carton arrive à l’entrepôt sans destinataire identifiable. Il attend, et les frais de stockage courent.',
    aFaire:
      'Le code client doit figurer à la fois sur l’étiquette et sur les cartons. C’est lui, et lui seul, qui rattache un colis à votre compte.',
  },
  {
    titre: 'Envoyer l’adresse en français ou en anglais seulement',
    consequence:
      'Le transporteur local lit l’adresse en caractères chinois. Une adresse latine seule se traduit mal et se livre mal.',
    aFaire: 'Collez le bloc en chinois tel quel, sans le retaper et sans le traduire.',
  },
  {
    titre: 'Ne pas annoncer le colis au transitaire',
    consequence:
      'L’entrepôt reçoit une marchandise qu’il n’attendait pas et ne peut ni la vérifier ni la grouper au bon départ.',
    aFaire:
      'Prévenez votre transitaire du nombre de cartons, du poids et de la date d’envoi dès que le fournisseur expédie.',
  },
  {
    titre: 'Laisser le fournisseur choisir la description et la valeur déclarée',
    consequence:
      'Une description approximative ou une valeur sous-déclarée fait rouvrir le dossier au dédouanement, et les frais de stationnement courent pendant ce temps.',
    aFaire:
      'Mettez-vous d’accord par écrit sur la description exacte et la valeur avant l’expédition, et demandez la facture commerciale et la liste de colisage.',
  },
];

/**
 * Code client lisible : `WS-` suivi de six caractères d'un alphabet sans ambiguïté.
 *
 * Il sera recopié à la main sur des cartons, parfois au marqueur : ni O/0 ni I/l/1, et
 * pas de minuscules. C'est la fonction, pas le tirage, qui vit ici — le tirage se fait
 * côté serveur, où il y a une source aléatoire digne de ce nom.
 */
export const CLIENT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CLIENT_CODE_LENGTH = 6;

export function isClientCode(value: string): boolean {
  const motif = new RegExp(`^WS-[${CLIENT_CODE_ALPHABET}]{${CLIENT_CODE_LENGTH}}$`);
  return motif.test(value);
}
