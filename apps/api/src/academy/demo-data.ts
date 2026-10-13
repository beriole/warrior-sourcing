import type { CourseAccess, CourseLevel, CourseTheme, ResourceType } from '@ws/contracts';
import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * DONNÉES DE DÉMONSTRATION de l'Academy (lot ACA).
 *
 * ⚠ Tout ce qui suit est FICTIF et marqué « DÉMO — ». Rien n'est un conseil réel, aucune
 * durée, aucun prix et aucun avis ne correspond à une formation existante.
 *
 * Deux choix assumés, pour ne rien inventer (§54) :
 *   - aucune leçon ne porte d'identifiant vidéo : aucun fichier n'a été déposé chez
 *     Cloudinary, donc l'API répond `playbackUrl: null` avec sa raison, et le lecteur
 *     affiche cet état plutôt qu'une vidéo cassée ;
 *   - les fichiers des ressources sont de vrais fichiers texte intégrés (`data:`), au format
 *     `txt` annoncé. Une ressource volontairement laissée sans fichier montre l'état
 *     « pas encore déposée ».
 *
 * Le jeu de données vit ici plutôt que dans `prisma/` : il est ainsi compilé, typé et
 * vérifié comme le reste du code du lot.
 */

const DEMO_PREFIX = 'DÉMO — ';
const DEMO_SOURCE = 'Contenu de démonstration, écrit pour les tests';

interface DemoLesson {
  slug: string;
  title: string;
  summary: string;
  durationMinutes: number;
  /** Extrait offert : lisible sans achat ni compte. */
  preview?: boolean;
  documents?: { title: string; body: string }[];
}

interface DemoQuestion {
  prompt: string;
  explanation: string;
  /** La bonne réponse est la première : le mélange est fait à l'insertion. */
  choices: { label: string; correct: boolean }[];
}

interface DemoChapter {
  title: string;
  summary: string;
  lessons: DemoLesson[];
  quiz?: { title: string; passScorePercent: number; questions: DemoQuestion[] };
}

interface DemoReview {
  /** Compte fictif : aucune ligne `user` n'est créée pour lui. */
  userId: string;
  authorName: string;
  rating: number;
  comment: string | null;
  publishedAt: string;
}

interface DemoCourse {
  slug: string;
  title: string;
  summary: string;
  description: string;
  level: CourseLevel;
  theme: CourseTheme;
  access: CourseAccess;
  priceXaf: number;
  outcomes: string[];
  prerequisites: string[];
  instructor: 'terrain' | 'transit';
  hue: number;
  publishedAt: string;
  chapters: DemoChapter[];
  reviews: DemoReview[];
}

interface DemoResource {
  slug: string;
  title: string;
  description: string;
  type: ResourceType;
  theme: CourseTheme;
  pageCount: number | null;
  /** Contenu réel du fichier de démonstration. `null` : ressource pas encore déposée. */
  body: string | null;
  free: boolean;
  courseSlug?: string;
  publishedAt: string;
}

const INSTRUCTORS = {
  terrain: {
    id: 'demo-aca-formateur-terrain',
    name: `${DEMO_PREFIX}Bériole T.`,
    headline: 'Achète en Chine pour des commerçants de Douala depuis 2019.',
    bio: 'Profil de démonstration. Les parcours réels des formateurs seront saisis depuis le back-office.',
  },
  transit: {
    id: 'demo-aca-formateur-transit',
    name: `${DEMO_PREFIX}Claire N.`,
    headline: 'Travaille au dédouanement au port de Douala.',
    bio: 'Profil de démonstration. Les parcours réels des formateurs seront saisis depuis le back-office.',
  },
} as const;

const COURSES: DemoCourse[] = [
  {
    slug: 'demo-aca-bases-import',
    title: `${DEMO_PREFIX}Les bases de l’importation`,
    summary:
      'Comprendre ce qu’on achète, ce qu’on paie en plus de la marchandise, et ce qui peut mal se passer sur une première commande.',
    description:
      'Formation d’introduction. Elle part du vocabulaire (MOQ, FOB, groupage) et va jusqu’au calcul du coût rendu à Douala. Les montants cités sont des exemples de démonstration, pas des tarifs.',
    level: 'BEGINNER',
    theme: 'BASICS',
    access: 'FREE',
    priceXaf: 0,
    outcomes: [
      'Lire une offre fournisseur et repérer ce qu’elle ne dit pas.',
      'Décomposer un coût rendu : marchandise, transport interne, fret, douane, livraison.',
      'Évaluer le capital à immobiliser avant de commander.',
    ],
    prerequisites: ['Aucun. Cette formation suppose qu’aucune importation n’a encore été faite.'],
    instructor: 'terrain',
    hue: 210,
    publishedAt: '2026-09-01T08:00:00.000Z',
    chapters: [
      {
        title: 'Le vocabulaire et les acteurs',
        summary: 'Qui fait quoi entre l’usine, le transitaire, la douane et vous.',
        lessons: [
          {
            slug: 'qui-fait-quoi',
            title: 'Qui fait quoi dans une importation',
            summary: 'Usine, trading company, transitaire, transporteur local : les rôles et leurs limites.',
            durationMinutes: 9,
            preview: true,
          },
          {
            slug: 'les-mots-qui-reviennent',
            title: 'Les mots qui reviennent dans les offres',
            summary: 'MOQ, échantillon, FOB, EXW, groupage, conteneur complet.',
            durationMinutes: 12,
            documents: [
              {
                title: 'Lexique de l’import (démonstration)',
                body: "MOQ : quantité minimum acceptée par le fournisseur.\nFOB : marchandise remise au port de depart, fret non inclus.\nEXW : marchandise disponible a l'usine, tout le reste a votre charge.\nGroupage : votre marchandise partage un conteneur avec celle d'autres importateurs.\n\nFichier de demonstration.",
              },
            ],
          },
          {
            slug: 'ce-qui-coute-en-plus',
            title: 'Tout ce qui s’ajoute au prix d’achat',
            summary: 'Transport interne en Chine, inspection, emballage, fret, douane, livraison locale.',
            durationMinutes: 15,
          },
        ],
        quiz: {
          title: 'Vérifier les bases',
          passScorePercent: 70,
          questions: [
            {
              prompt: 'Que signifie « MOQ » dans une offre fournisseur ?',
              explanation: 'Le MOQ est la quantité minimum que le fournisseur accepte de produire ou de vendre.',
              choices: [
                { label: 'La quantité minimum de commande', correct: true },
                { label: 'Le délai minimum de production', correct: false },
                { label: 'La marge minimum conseillée', correct: false },
              ],
            },
            {
              prompt: 'Un prix annoncé « FOB Shenzhen » comprend-il le fret maritime jusqu’à Douala ?',
              explanation: 'FOB s’arrête au port de départ : le fret, l’assurance et la douane restent à votre charge.',
              choices: [
                { label: 'Non, il s’arrête au port de départ', correct: true },
                { label: 'Oui, fret et assurance inclus', correct: false },
                { label: 'Oui, mais sans la douane', correct: false },
              ],
            },
            {
              prompt: 'Le coût rendu d’un produit, c’est :',
              explanation:
                'Le coût rendu additionne tout ce qu’il faut payer pour que la pièce soit disponible au Cameroun.',
              choices: [
                { label: 'Tout ce qu’il faut payer pour l’avoir en main au Cameroun', correct: true },
                { label: 'Le prix payé à l’usine', correct: false },
                { label: 'Le prix de vente conseillé', correct: false },
              ],
            },
          ],
        },
      },
      {
        title: 'Préparer une première commande',
        summary: 'Du budget disponible à la quantité raisonnable.',
        lessons: [
          {
            slug: 'budget-et-quantite',
            title: 'Partir du budget, pas de la quantité',
            summary: 'Pourquoi on calcule combien on peut acheter, et jamais combien il « faudrait » acheter.',
            durationMinutes: 11,
          },
          {
            slug: 'les-erreurs-frequentes',
            title: 'Les erreurs qui coûtent cher',
            summary: 'Commander sans échantillon, négliger le poids, oublier la douane, payer hors traçabilité.',
            durationMinutes: 14,
            documents: [
              {
                title: 'Checklist avant de payer (démonstration)',
                body: "1. Echantillon recu et conforme.\n2. Poids et dimensions confirmes par le fournisseur.\n3. Mode de transport choisi et delai annonce par ecrit.\n4. Paiement tracable, jamais en dehors d'un canal verifiable.\n5. Budget restant suffisant pour la douane et la livraison locale.\n\nFichier de demonstration.",
              },
            ],
          },
        ],
      },
    ],
    reviews: [
      {
        userId: 'demo-aca-avis-1',
        authorName: `${DEMO_PREFIX}Arlette M.`,
        rating: 5,
        comment: 'Avis de démonstration : le chapitre sur le coût rendu m’a évité une erreur de budget.',
        publishedAt: '2026-09-18T10:00:00.000Z',
      },
      {
        userId: 'demo-aca-avis-2',
        authorName: `${DEMO_PREFIX}Serge K.`,
        rating: 4,
        comment: 'Avis de démonstration : clair, j’aurais aimé plus d’exemples chiffrés.',
        publishedAt: '2026-09-20T10:00:00.000Z',
      },
    ],
  },
  {
    slug: 'demo-aca-sourcing-1688',
    title: `${DEMO_PREFIX}Trouver un produit et son fournisseur`,
    summary:
      'Méthode de recherche sur les plateformes chinoises, lecture d’une fiche usine et vérification avant la première commande.',
    description:
      'Formation payante de démonstration. La première leçon est offerte en extrait : elle montre la méthode de recherche. Le reste du programme s’ouvre après achat.',
    level: 'INTERMEDIATE',
    theme: 'SOURCING',
    access: 'PAID',
    priceXaf: 15_000,
    outcomes: [
      'Construire une recherche produit qui ne se limite pas au premier résultat.',
      'Comparer trois fournisseurs sur des critères identiques.',
      'Demander et évaluer un échantillon.',
    ],
    prerequisites: ['Avoir suivi « Les bases de l’importation » ou connaître le vocabulaire de l’import.'],
    instructor: 'terrain',
    hue: 28,
    publishedAt: '2026-09-05T08:00:00.000Z',
    chapters: [
      {
        title: 'Chercher sans se perdre',
        summary: 'La recherche produit, étape par étape.',
        lessons: [
          {
            slug: 'methode-de-recherche',
            title: 'La méthode de recherche',
            summary: 'Partir d’un besoin local, pas d’un produit vu en ligne.',
            durationMinutes: 13,
            preview: true,
          },
          {
            slug: 'lire-une-fiche-usine',
            title: 'Lire une fiche usine',
            summary: 'Ancienneté, capacité, certifications annoncées, et ce qui reste à vérifier.',
            durationMinutes: 16,
          },
        ],
      },
      {
        title: 'Vérifier avant de payer',
        summary: 'Échantillon, comparaison, premier contact.',
        lessons: [
          {
            slug: 'demander-un-echantillon',
            title: 'Demander un échantillon utile',
            summary: 'Ce qu’on demande, ce qu’on mesure, ce qu’on garde comme preuve.',
            durationMinutes: 12,
          },
          {
            slug: 'comparer-trois-offres',
            title: 'Comparer trois offres sur les mêmes critères',
            summary: 'Prix, MOQ, délai, personnalisation, paiement, échantillon.',
            durationMinutes: 18,
            documents: [
              {
                title: 'Grille de comparaison (démonstration)',
                body: "Critere ; Fournisseur A ; Fournisseur B ; Fournisseur C\nPrix unitaire ;  ;  ; \nMOQ ;  ;  ; \nDelai annonce ;  ;  ; \nEchantillon ;  ;  ; \nMode de paiement ;  ;  ; \n\nFichier de demonstration.",
              },
            ],
          },
        ],
        quiz: {
          title: 'Vérifier sa méthode de sourcing',
          passScorePercent: 60,
          questions: [
            {
              prompt: 'Sur quoi compare-t-on deux fournisseurs en premier ?',
              explanation: 'Comparer des critères identiques évite de choisir le moins cher sur un périmètre différent.',
              choices: [
                { label: 'Les mêmes critères, listés à l’avance', correct: true },
                { label: 'Le prix unitaire seul', correct: false },
                { label: 'Le nombre d’années d’activité', correct: false },
              ],
            },
            {
              prompt: 'À quoi sert un échantillon ?',
              explanation:
                'L’échantillon sert à mesurer et à garder une preuve de ce qui a été promis, pas seulement à voir le produit.',
              choices: [
                { label: 'À mesurer et à garder une preuve de ce qui a été promis', correct: true },
                { label: 'À obtenir une remise', correct: false },
                { label: 'À réserver la production', correct: false },
              ],
            },
          ],
        },
      },
    ],
    reviews: [
      {
        userId: 'demo-aca-avis-3',
        authorName: `${DEMO_PREFIX}Nadège O.`,
        rating: 5,
        comment: 'Avis de démonstration : la grille de comparaison sert à chaque commande.',
        publishedAt: '2026-09-22T10:00:00.000Z',
      },
    ],
  },
  {
    slug: 'demo-aca-payer-sans-se-faire-avoir',
    title: `${DEMO_PREFIX}Payer un fournisseur sans se faire avoir`,
    summary:
      'Quand payer, combien, et ce qu’il faut avoir vérifié avant de virer le solde.',
    description:
      'Formation de démonstration. Elle part des situations les plus souvent rapportées : un acompte versé après de bons échanges, puis un prix révisé ou une marchandise qui ne correspond pas à la commande. Aucune garantie n’est donnée : ce sont des précautions, pas une assurance.',
    level: 'BEGINNER',
    theme: 'PAYMENT',
    access: 'PAID',
    priceXaf: 5_000,
    outcomes: [
      'Découper un paiement en plusieurs versements liés à des preuves.',
      'Savoir ce qu’il faut avoir reçu avant de régler le solde.',
      'Reconnaître les situations où un fournisseur révise ses conditions après l’acompte.',
    ],
    prerequisites: ['Aucun. Cette formation suppose qu’aucun paiement n’a encore été fait.'],
    instructor: 'terrain',
    hue: 28,
    publishedAt: '2026-09-18T08:00:00.000Z',
    chapters: [
      {
        title: 'Découper le paiement',
        summary: 'Ce qui se décide avant le premier virement.',
        lessons: [
          {
            slug: 'pourquoi-jamais-cent-pour-cent',
            title: 'Pourquoi jamais 100 % d’avance',
            summary:
              'Payer la totalité avant production retire le seul moyen de pression qui reste si la marchandise ne correspond pas.',
            durationMinutes: 9,
            preview: true,
          },
          {
            slug: 'acompte-et-solde',
            title: 'Acompte, solde, et ce qui les déclenche',
            summary:
              'Lier chaque versement à une preuve : photos de production, rapport d’inspection, document de transport.',
            durationMinutes: 12,
          },
          {
            slug: 'le-prix-revise-apres-commande',
            title: 'Le prix révisé après l’acompte',
            summary:
              'Ce qui se passe quand le fournisseur annonce une hausse une fois l’acompte reçu, et comment l’éviter par écrit.',
            durationMinutes: 11,
            documents: [
              {
                title: 'Clauses à écrire avant de verser un acompte',
                body: 'Document de démonstration. Points à faire figurer par écrit : prix unitaire ferme et sa durée de validité, quantité exacte, référence et spécification du produit, délai de production, conditions de remboursement de l’acompte si la commande n’est pas honorée.',
              },
            ],
          },
        ],
      },
      {
        title: 'Vérifier avant de régler',
        summary: 'Ce qu’une inspection regarde, et ce qu’elle ne regarde pas.',
        lessons: [
          {
            slug: 'inspection-avant-solde',
            title: 'Faire inspecter avant de régler le solde',
            summary:
              'Quantité, conformité à l’échantillon, emballage. Ce qu’un rapport d’inspection établit, et ses limites.',
            durationMinutes: 13,
          },
        ],
      },
    ],
    reviews: [],
  },
  {
    slug: 'demo-aca-cout-rendu-et-tresorerie',
    title: `${DEMO_PREFIX}Coût rendu et trésorerie`,
    summary:
      'Droits, taxes, frais de port et immobilisation : ce qui transforme une bonne affaire en perte.',
    description:
      'Formation de démonstration, la plus avancée du catalogue. Elle porte sur ce qui se paie après la marchandise et sur l’argent immobilisé entre la commande et la vente. Les montants cités sont des exemples : seuls les tarifs saisis dans le calculateur font foi.',
    level: 'ADVANCED',
    theme: 'LOGISTICS',
    access: 'PAID',
    priceXaf: 20_000,
    outcomes: [
      'Construire un coût rendu complet, frais annexes compris.',
      'Anticiper les frais qui courent quand un dossier traîne au port.',
      'Estimer la durée d’immobilisation du capital, de l’acompte à la première vente.',
    ],
    prerequisites: ['Avoir déjà reçu au moins une commande au Cameroun.'],
    instructor: 'transit',
    hue: 268,
    publishedAt: '2026-09-25T08:00:00.000Z',
    chapters: [
      {
        title: 'Ce qui se paie après la marchandise',
        summary: 'La part du coût que les premières commandes oublient.',
        lessons: [
          {
            slug: 'droits-taxes-et-valeur-declaree',
            title: 'Droits, taxes et valeur déclarée',
            summary:
              'Sur quelle valeur les droits se calculent, et pourquoi sous-déclarer coûte plus cher que ça ne rapporte.',
            durationMinutes: 14,
            preview: true,
          },
          {
            slug: 'le-code-sh-et-ses-consequences',
            title: 'Le code SH et ses conséquences',
            summary:
              'Une classification tarifaire erronée change le taux applicable et fait rouvrir le dossier. Comment la faire confirmer avant l’expédition.',
            durationMinutes: 12,
          },
          {
            slug: 'assurance-et-risque-transport',
            title: 'Assurance et risque de transport',
            summary:
              'Ce qui est couvert, ce qui ne l’est jamais, et à partir de quelle valeur de marchandise la question se pose.',
            durationMinutes: 10,
          },
        ],
      },
      {
        title: 'L’argent immobilisé',
        summary: 'Entre l’acompte et la première vente, le capital ne travaille pas.',
        lessons: [
          {
            slug: 'frais-qui-courent-au-port',
            title: 'Les frais qui courent au port',
            summary:
              'Stationnement et immobilisation du conteneur se facturent au jour. Un dossier incomplet se paie donc deux fois.',
            durationMinutes: 13,
            documents: [
              {
                title: 'Dossier à réunir avant l’arrivée',
                body: 'Document de démonstration. Pièces le plus souvent demandées : facture commerciale, liste de colisage, document de transport, certificat d’origine lorsqu’il est exigé, et classification tarifaire confirmée. La liste réelle doit être vérifiée auprès de l’administration et de votre transitaire.',
              },
            ],
          },
          {
            slug: 'duree-d-immobilisation',
            title: 'Combien de temps l’argent dort',
            summary:
              'Compter les semaines entre l’acompte et la première vente, et ce que cela change sur la quantité à commander.',
            durationMinutes: 12,
          },
        ],
      },
    ],
    reviews: [],
  },
  {
    slug: 'demo-aca-negocier-fournisseur',
    title: `${DEMO_PREFIX}Négocier avec un fournisseur chinois`,
    summary: 'Préparer une négociation, écrire un message qui obtient une réponse, tenir ses conditions.',
    description:
      'Formation de démonstration incluse dans l’abonnement. Les droits d’abonnement sont gérés par le lot SUB : ici, seul l’accès est modélisé.',
    level: 'ADVANCED',
    theme: 'NEGOTIATION',
    access: 'SUBSCRIPTION',
    priceXaf: 0,
    outcomes: [
      'Préparer ses limites avant d’écrire au fournisseur.',
      'Obtenir une réponse à un premier message.',
      'Négocier autre chose que le prix : délai, emballage, échantillon.',
    ],
    prerequisites: ['Avoir déjà passé au moins une commande.'],
    instructor: 'terrain',
    hue: 348,
    publishedAt: '2026-09-10T08:00:00.000Z',
    chapters: [
      {
        title: 'Préparer et conduire la négociation',
        summary: 'Ce qui se décide avant d’écrire.',
        lessons: [
          {
            slug: 'preparer-ses-limites',
            title: 'Préparer ses limites',
            summary: 'Prix plafond, quantité plancher, délai acceptable : décidés avant le premier message.',
            durationMinutes: 10,
            preview: true,
          },
          {
            slug: 'ecrire-le-premier-message',
            title: 'Écrire le premier message',
            summary: 'Court, précis, vérifiable. Pourquoi « best price ? » n’obtient rien.',
            durationMinutes: 11,
          },
          {
            slug: 'negocier-autre-chose-que-le-prix',
            title: 'Négocier autre chose que le prix',
            summary: 'Emballage, marquage, délai, échantillon gratuit, échelonnement du paiement.',
            durationMinutes: 14,
          },
        ],
      },
    ],
    reviews: [],
  },
  {
    slug: 'demo-aca-douane-cameroun',
    title: `${DEMO_PREFIX}Passer la douane au Cameroun`,
    summary: 'Les documents demandés, l’ordre des étapes au port, et ce qui bloque un dossier.',
    description:
      'Formation de démonstration. Les procédures réelles doivent être confirmées auprès de l’administration : rien ici ne tient lieu de référence officielle.',
    level: 'INTERMEDIATE',
    theme: 'CUSTOMS',
    access: 'PAID',
    priceXaf: 10_000,
    outcomes: [
      'Savoir quels documents réunir avant l’arrivée du conteneur.',
      'Suivre un dossier au port sans se faire dépasser par les délais.',
    ],
    prerequisites: ['Avoir une commande en cours ou prévue.'],
    instructor: 'transit',
    hue: 150,
    publishedAt: '2026-09-15T08:00:00.000Z',
    chapters: [
      {
        title: 'Le dossier et le port',
        summary: 'Des documents à la sortie du conteneur.',
        lessons: [
          {
            slug: 'les-documents-du-dossier',
            title: 'Les documents du dossier',
            summary: 'Facture, liste de colisage, connaissement, déclaration : à quoi sert chaque pièce.',
            durationMinutes: 13,
            preview: true,
          },
          {
            slug: 'l-ordre-des-etapes',
            title: 'L’ordre des étapes au port',
            summary: 'Arrivée, déclaration, liquidation, paiement, enlèvement.',
            durationMinutes: 16,
          },
          {
            slug: 'ce-qui-bloque-un-dossier',
            title: 'Ce qui bloque un dossier',
            summary: 'Valeur déclarée incohérente, colisage incomplet, produit soumis à autorisation.',
            durationMinutes: 12,
          },
        ],
      },
    ],
    reviews: [],
  },
];

const RESOURCES: DemoResource[] = [
  {
    slug: 'demo-aca-checklist-premiere-commande',
    title: `${DEMO_PREFIX}Checklist d’une première commande`,
    description: 'Les douze points à cocher avant d’envoyer le premier paiement à un fournisseur.',
    type: 'CHECKLIST',
    theme: 'BASICS',
    pageCount: 2,
    body: "Checklist de demonstration.\n\n[ ] Echantillon recu\n[ ] Poids et dimensions confirmes\n[ ] Mode de transport choisi\n[ ] Delai annonce par ecrit\n[ ] Paiement tracable\n[ ] Budget douane et livraison garde de cote\n",
    free: true,
    courseSlug: 'demo-aca-bases-import',
    publishedAt: '2026-09-02T08:00:00.000Z',
  },
  {
    slug: 'demo-aca-modele-fiche-produit',
    title: `${DEMO_PREFIX}Modèle de fiche produit`,
    description: 'Un tableau à remplir par produit : coût rendu, prix local constaté, marge, points de vigilance.',
    type: 'TEMPLATE',
    theme: 'SOURCING',
    pageCount: 1,
    body: "Modele de demonstration.\n\nProduit :\nPrix d'achat (CNY) :\nPoids unitaire (g) :\nMOQ :\nCout rendu estime (FCFA) :\nPrix local constate (FCFA) et date du releve :\nPoints de vigilance :\n",
    free: true,
    courseSlug: 'demo-aca-sourcing-1688',
    publishedAt: '2026-09-06T08:00:00.000Z',
  },
  {
    slug: 'demo-aca-grille-comparaison-fournisseurs',
    title: `${DEMO_PREFIX}Grille de comparaison de fournisseurs`,
    description: 'Comparer trois offres sur des critères identiques, sans se laisser guider par le prix seul.',
    type: 'CHECKLIST',
    theme: 'SUPPLIERS',
    pageCount: 1,
    body: "Grille de demonstration.\n\nCritere ; A ; B ; C\nPrix unitaire ;  ;  ; \nMOQ ;  ;  ; \nDelai ;  ;  ; \nEchantillon ;  ;  ; \nPersonnalisation ;  ;  ; \nPaiement ;  ;  ; \n",
    free: true,
    publishedAt: '2026-09-08T08:00:00.000Z',
  },
  {
    slug: 'demo-aca-guide-modes-de-transport',
    title: `${DEMO_PREFIX}Guide des modes de transport`,
    description: 'Aérien, maritime, express : ce que chacun coûte en temps, en risque et en trésorerie.',
    type: 'GUIDE',
    theme: 'LOGISTICS',
    pageCount: 6,
    body: "Guide de demonstration. Les ordres de grandeur reels sont saisis par l'administrateur dans le lot CARGO : ce fichier ne contient aucun tarif.\n",
    free: true,
    publishedAt: '2026-09-11T08:00:00.000Z',
  },
  {
    slug: 'demo-aca-fiche-documents-douane',
    title: `${DEMO_PREFIX}Fiche pratique : les documents de douane`,
    description: 'Une page par document : à quoi il sert, qui l’émet, ce qui le rend invalide.',
    type: 'FACT_SHEET',
    theme: 'CUSTOMS',
    pageCount: 4,
    body: "Fiche de demonstration. Les procedures doivent etre confirmees aupres de l'administration douaniere.\n",
    free: true,
    courseSlug: 'demo-aca-douane-cameroun',
    publishedAt: '2026-09-16T08:00:00.000Z',
  },
  {
    slug: 'demo-aca-dossier-negociation',
    title: `${DEMO_PREFIX}Dossier de négociation`,
    description:
      'Modèles de messages et tableau de suivi des conditions obtenues. Réservé aux inscrits de la formation « Négocier avec un fournisseur chinois ».',
    type: 'PDF',
    theme: 'NEGOTIATION',
    pageCount: null,
    // Volontairement sans fichier : montre l'état « pas encore déposée » sans inventer de PDF.
    body: null,
    free: false,
    courseSlug: 'demo-aca-negocier-fournisseur',
    publishedAt: '2026-09-12T08:00:00.000Z',
  },
];

/**
 * Photographies des couvertures, servies par le site depuis `public/images/formations/`.
 *
 * Elles ont remplacé un rectangle coloré portant le titre. Le rectangle avait un mérite —
 * il ne prétendait rien — mais sur une page qui vend des formations, il dit surtout que le
 * produit n'est pas fini. Chaque photo illustre le **sujet** du cours, sans affirmer un
 * lieu ni montrer un visage reconnaissable : voir `apps/web/public/images/CREDITS.md`.
 *
 * Le chemin est relatif à la racine du site : il vaut donc aussi dans le back-office, qui
 * sert les mêmes fichiers. Une formation sans entrée ici garde `coverUrl: null`, et la
 * carte affiche son état « aucun visuel » plutôt qu'une image cassée.
 */
const COUVERTURES: Record<string, string> = {
  'demo-aca-bases-import': '/images/formations/bases-import.jpg',
  'demo-aca-sourcing-1688': '/images/formations/sourcing.jpg',
  'demo-aca-payer-sans-se-faire-avoir': '/images/formations/payer.jpg',
  'demo-aca-cout-rendu-et-tresorerie': '/images/formations/cout-rendu.jpg',
  'demo-aca-negocier-fournisseur': '/images/formations/negocier.jpg',
  'demo-aca-douane-cameroun': '/images/formations/douane.jpg',
};

/** Fichier texte de démonstration, réellement lisible : le format annoncé est `txt`. */
function textFile(body: string): string {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`;
}

/**
 * Insère (ou remet à jour) l'Academy de démonstration.
 *
 * Idempotent, et sans effacer la progression : les chapitres, leçons, quiz et questions sont
 * repris par leur position ou leur identifiant d'URL plutôt que supprimés et recréés.
 */
export async function seedAcademyDemoData(prisma: PrismaClient): Promise<{ courses: number; lessons: number; resources: number }> {
  for (const instructor of Object.values(INSTRUCTORS)) {
    const data = { name: instructor.name, headline: instructor.headline, bio: instructor.bio, photoUrl: null };
    await prisma.instructor.upsert({ where: { id: instructor.id }, create: { id: instructor.id, ...data }, update: data });
  }

  let lessonCount = 0;

  for (const demo of COURSES) {
    const common = {
      title: demo.title,
      summary: demo.summary,
      description: `${demo.description} (${DEMO_SOURCE}.)`,
      level: demo.level,
      theme: demo.theme,
      access: demo.access,
      priceXaf: demo.priceXaf,
      outcomes: demo.outcomes,
      prerequisites: demo.prerequisites,
      coverUrl: COUVERTURES[demo.slug] ?? null,
      // Aucun extrait vidéo n'a été déposé : la fiche n'annonce donc pas de bande-annonce.
      trailerUrl: null,
      instructorId: INSTRUCTORS[demo.instructor].id,
      publishedAt: new Date(demo.publishedAt),
    };

    const course = await prisma.course.upsert({
      where: { slug: demo.slug },
      create: { slug: demo.slug, ...common },
      update: common,
    });

    for (const [position, chapterDemo] of demo.chapters.entries()) {
      const chapterData = { title: chapterDemo.title, summary: chapterDemo.summary };
      const chapter = await prisma.chapter.upsert({
        where: { courseId_position: { courseId: course.id, position } },
        create: { courseId: course.id, position, ...chapterData },
        update: chapterData,
      });

      for (const [lessonPosition, lessonDemo] of chapterDemo.lessons.entries()) {
        const lessonData = {
          chapterId: chapter.id,
          title: lessonDemo.title,
          summary: lessonDemo.summary,
          position: lessonPosition,
          durationMinutes: lessonDemo.durationMinutes,
          // Aucune vidéo déposée : l'API répondra `playbackUrl: null` avec sa raison.
          videoPublicId: null,
          videoFormat: null,
          preview: lessonDemo.preview ?? false,
          publishedAt: new Date(demo.publishedAt),
        };

        const lesson = await prisma.lesson.upsert({
          where: { courseId_slug: { courseId: course.id, slug: lessonDemo.slug } },
          create: { courseId: course.id, slug: lessonDemo.slug, ...lessonData },
          update: lessonData,
        });
        lessonCount += 1;

        await prisma.lessonDocument.deleteMany({ where: { lessonId: lesson.id } });
        if (lessonDemo.documents?.length) {
          await prisma.lessonDocument.createMany({
            data: lessonDemo.documents.map((document, index) => ({
              lessonId: lesson.id,
              title: document.title,
              fileFormat: 'txt',
              sizeBytes: Buffer.byteLength(document.body, 'utf8'),
              url: textFile(document.body),
              position: index,
            })),
          });
        }
      }

      if (chapterDemo.quiz) {
        const quizData = { title: chapterDemo.quiz.title, passScorePercent: chapterDemo.quiz.passScorePercent };
        const quiz = await prisma.quiz.upsert({
          where: { chapterId: chapter.id },
          create: { chapterId: chapter.id, ...quizData },
          update: quizData,
        });

        for (const [questionPosition, questionDemo] of chapterDemo.quiz.questions.entries()) {
          const questionData = { prompt: questionDemo.prompt, explanation: questionDemo.explanation };
          const question = await prisma.quizQuestion.upsert({
            where: { quizId_position: { quizId: quiz.id, position: questionPosition } },
            create: { quizId: quiz.id, position: questionPosition, ...questionData },
            update: questionData,
          });

          await prisma.quizChoice.deleteMany({ where: { questionId: question.id } });
          await prisma.quizChoice.createMany({
            data: questionDemo.choices.map((choice, index) => ({
              questionId: question.id,
              label: choice.label,
              correct: choice.correct,
              position: index,
            })),
          });
        }
      }
    }

    for (const review of demo.reviews) {
      const reviewData = {
        authorName: review.authorName,
        rating: review.rating,
        comment: review.comment,
        publishedAt: new Date(review.publishedAt),
      };
      await prisma.courseReview.upsert({
        where: { courseId_userId: { courseId: course.id, userId: review.userId } },
        create: { courseId: course.id, userId: review.userId, ...reviewData },
        update: reviewData,
      });
    }
  }

  for (const resource of RESOURCES) {
    const course = resource.courseSlug
      ? await prisma.course.findUnique({ where: { slug: resource.courseSlug }, select: { id: true } })
      : null;

    const data = {
      title: resource.title,
      description: resource.description,
      type: resource.type,
      theme: resource.theme,
      fileFormat: resource.body === null ? 'pdf' : 'txt',
      sizeBytes: resource.body === null ? null : Buffer.byteLength(resource.body, 'utf8'),
      pageCount: resource.pageCount,
      filePublicId: null,
      fileUrl: resource.body === null ? null : textFile(resource.body),
      courseId: course?.id ?? null,
      free: resource.free,
      publishedAt: new Date(resource.publishedAt),
    };

    await prisma.libraryResource.upsert({
      where: { slug: resource.slug },
      create: { slug: resource.slug, ...data },
      update: data,
    });
  }

  return { courses: COURSES.length, lessons: lessonCount, resources: RESOURCES.length };
}
