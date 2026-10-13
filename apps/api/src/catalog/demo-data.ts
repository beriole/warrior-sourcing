import type { InterestCategory } from '@ws/contracts';
import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * DONNÉES DE DÉMONSTRATION — lot CAT.
 *
 * Elles servent uniquement à faire vivre les écrans en développement et en démonstration.
 * Rien ici n'est un relevé réel : chaque source le dit explicitement, et aucune de ces
 * lignes ne doit servir à décider d'un achat. Le catalogue réel sera saisi par
 * l'administration (lot ADM) avec de vraies sources datées.
 */
const DEMO_SOURCE = 'Données de démonstration — ne pas utiliser pour décider';

/** Préfixe qui identifie sans ambiguïté un produit de démonstration, jusque dans l'interface. */
const DEMO_PREFIX = 'DÉMO — ';

/** Taux fictif servant à convertir les prix d'achat de démonstration. */
const DEMO_RATE_CNY_TO_XAF = 84;
const DEMO_RATE_OBSERVED_AT = new Date('2026-09-20T00:00:00.000Z');

type DemoMarket = {
  localPriceMinXaf?: number;
  localPriceMaxXaf?: number;
  localPriceObservedAt?: string;
  demand?: 'LOW' | 'MEDIUM' | 'HIGH';
  competition?: 'LOW' | 'MEDIUM' | 'HIGH';
  risk?: 'LOW' | 'MEDIUM' | 'HIGH';
  transportEase?: 'EASY' | 'MODERATE' | 'DIFFICULT';
  capitalRequiredXaf?: number;
  assessedAt?: string;
};

type DemoProduct = {
  slug: string;
  name: string;
  description: string;
  category: InterestCategory;
  /** Prix d'achat en Chine, en yuans (unités majeures) : converti plus bas. */
  priceCny: number;
  moq: number;
  weightGrams: number;
  volumeCm3: number | null;
  badges: (
    | 'LOW_MOQ'
    | 'LIGHT_WEIGHT'
    | 'SMALL_VOLUME'
    | 'SAMPLE_AVAILABLE'
    | 'CUSTOMIZABLE'
    | 'VERIFIED_SUPPLIER'
    | 'FRAGILE'
    | 'BATTERY'
  )[];
  watchPoints: string[];
  publishedAt: string;
  /** Absent volontairement pour certains produits : l'interface doit afficher l'absence. */
  market?: DemoMarket;
  /** Teinte de l'image de remplacement. */
  hue: number;
};

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    slug: 'ecouteurs-sans-fil-tws',
    name: 'Écouteurs sans fil TWS',
    description:
      'Écouteurs Bluetooth avec boîtier de charge. Modèle très demandé en boutique et sur les marchés urbains.',
    category: 'ACCESSORIES',
    priceCny: 38,
    moq: 50,
    weightGrams: 120,
    volumeCm3: 400,
    badges: ['LOW_MOQ', 'LIGHT_WEIGHT', 'SMALL_VOLUME', 'SAMPLE_AVAILABLE', 'BATTERY'],
    watchPoints: [
      'La batterie impose souvent le transport maritime : prévoyez un délai plus long.',
      'Testez l’autonomie annoncée sur un échantillon avant toute commande importante.',
    ],
    publishedAt: '2026-09-12T08:00:00.000Z',
    market: {
      localPriceMinXaf: 7_000,
      localPriceMaxXaf: 9_500,
      localPriceObservedAt: '2026-09-05T00:00:00.000Z',
      demand: 'HIGH',
      competition: 'HIGH',
      risk: 'MEDIUM',
      transportEase: 'MODERATE',
      capitalRequiredXaf: 250_000,
      assessedAt: '2026-09-05T00:00:00.000Z',
    },
    hue: 210,
  },
  {
    slug: 'coque-telephone-silicone',
    name: 'Coque de téléphone en silicone',
    description:
      'Coques souples pour modèles courants. Faible valeur unitaire, rotation rapide, personnalisation possible.',
    category: 'PHONES',
    priceCny: 4.5,
    moq: 200,
    weightGrams: 45,
    volumeCm3: 180,
    badges: ['LIGHT_WEIGHT', 'SMALL_VOLUME', 'CUSTOMIZABLE', 'SAMPLE_AVAILABLE'],
    watchPoints: [
      'Vérifiez la liste exacte des modèles de téléphones : une référence obsolète reste invendue.',
      'Le silicone bas de gamme jaunit : demandez une photo du produit après un mois d’usage.',
    ],
    publishedAt: '2026-09-15T08:00:00.000Z',
    market: {
      localPriceMinXaf: 1_500,
      localPriceMaxXaf: 2_500,
      localPriceObservedAt: '2026-09-10T00:00:00.000Z',
      demand: 'HIGH',
      competition: 'HIGH',
      risk: 'LOW',
      transportEase: 'EASY',
      capitalRequiredXaf: 150_000,
      assessedAt: '2026-09-10T00:00:00.000Z',
    },
    hue: 265,
  },
  {
    slug: 'montre-connectee-sport',
    name: 'Montre connectée sport',
    description: 'Montre avec suivi d’activité et notifications. Boîtier métal, bracelet interchangeable.',
    category: 'ELECTRONICS',
    priceCny: 95,
    moq: 30,
    weightGrams: 180,
    volumeCm3: 600,
    badges: ['LOW_MOQ', 'SAMPLE_AVAILABLE', 'BATTERY', 'VERIFIED_SUPPLIER'],
    watchPoints: [
      'L’application mobile doit exister en français : vérifiez-la avant de commander.',
      'Le service après-vente est à votre charge : prévoyez quelques pièces de remplacement.',
    ],
    publishedAt: '2026-09-08T08:00:00.000Z',
    market: {
      localPriceMinXaf: 22_000,
      localPriceMaxXaf: 30_000,
      localPriceObservedAt: '2026-09-02T00:00:00.000Z',
      demand: 'MEDIUM',
      competition: 'MEDIUM',
      risk: 'MEDIUM',
      transportEase: 'MODERATE',
      capitalRequiredXaf: 500_000,
      assessedAt: '2026-09-02T00:00:00.000Z',
    },
    hue: 190,
  },
  {
    slug: 'batterie-externe-10000',
    name: 'Batterie externe 10 000 mAh',
    description: 'Batterie de secours à double sortie USB, boîtier aluminium, écran de charge.',
    category: 'ELECTRONICS',
    priceCny: 42,
    moq: 50,
    weightGrams: 250,
    volumeCm3: 500,
    badges: ['LOW_MOQ', 'BATTERY', 'CUSTOMIZABLE'],
    watchPoints: [
      'Capacité réelle souvent inférieure à la capacité annoncée : faites peser et tester un échantillon.',
      'Transport aérien restreint pour les batteries : le maritime est le plus souvent imposé.',
    ],
    publishedAt: '2026-08-28T08:00:00.000Z',
    market: {
      localPriceMinXaf: 9_000,
      localPriceMaxXaf: 13_000,
      localPriceObservedAt: '2026-08-25T00:00:00.000Z',
      demand: 'HIGH',
      competition: 'MEDIUM',
      risk: 'MEDIUM',
      transportEase: 'DIFFICULT',
      capitalRequiredXaf: 300_000,
      assessedAt: '2026-08-25T00:00:00.000Z',
    },
    hue: 145,
  },
  {
    slug: 'sac-a-main-synthetique',
    name: 'Sac à main synthétique',
    description: 'Sac à main en cuir synthétique, plusieurs coloris, finitions métal doré.',
    category: 'FASHION',
    priceCny: 55,
    moq: 40,
    weightGrams: 700,
    volumeCm3: 6_000,
    badges: ['LOW_MOQ', 'CUSTOMIZABLE', 'SAMPLE_AVAILABLE'],
    watchPoints: [
      'Les coloris reçus diffèrent parfois des photos : exigez une photo réelle avant expédition.',
      'Volume important : le coût de transport pèse davantage que le prix d’achat.',
    ],
    publishedAt: '2026-09-01T08:00:00.000Z',
    market: {
      localPriceMinXaf: 15_000,
      localPriceMaxXaf: 22_000,
      localPriceObservedAt: '2026-08-30T00:00:00.000Z',
      demand: 'MEDIUM',
      competition: 'MEDIUM',
      risk: 'MEDIUM',
      transportEase: 'MODERATE',
      capitalRequiredXaf: 400_000,
      assessedAt: '2026-08-30T00:00:00.000Z',
    },
    hue: 20,
  },
  {
    slug: 'perruque-cheveux-synthetiques',
    name: 'Perruque en cheveux synthétiques',
    description: 'Perruque longue, fibre résistante à la chaleur, bonnet ajustable.',
    category: 'BEAUTY',
    priceCny: 70,
    moq: 20,
    weightGrams: 300,
    volumeCm3: 3_000,
    badges: ['LOW_MOQ', 'SAMPLE_AVAILABLE'],
    watchPoints: [
      'La qualité de fibre varie beaucoup d’un lot à l’autre : commandez un échantillon de chaque coloris.',
      'Produit très sensible aux effets de mode : évitez les grandes quantités au premier achat.',
    ],
    publishedAt: '2026-09-03T08:00:00.000Z',
    market: {
      localPriceMinXaf: 18_000,
      localPriceMaxXaf: 28_000,
      localPriceObservedAt: '2026-09-01T00:00:00.000Z',
      demand: 'HIGH',
      competition: 'LOW',
      risk: 'MEDIUM',
      transportEase: 'EASY',
      capitalRequiredXaf: 350_000,
      assessedAt: '2026-09-01T00:00:00.000Z',
    },
    hue: 330,
  },
  {
    slug: 'kit-led-auto',
    name: 'Kit d’éclairage LED pour voiture',
    description: 'Kit de phares LED H4/H7 avec ventilation, compatible avec la plupart des berlines.',
    category: 'AUTO_MOTO',
    priceCny: 60,
    moq: 50,
    weightGrams: 400,
    volumeCm3: 1_200,
    badges: ['SAMPLE_AVAILABLE', 'SMALL_VOLUME'],
    watchPoints: [
      'Vérifiez la compatibilité des culots avec les modèles les plus vendus localement.',
      'Certains kits chauffent trop : demandez la durée de vie annoncée et un test vidéo.',
    ],
    publishedAt: '2026-08-20T08:00:00.000Z',
    market: {
      localPriceMinXaf: 16_000,
      localPriceMaxXaf: 24_000,
      localPriceObservedAt: '2026-08-18T00:00:00.000Z',
      demand: 'MEDIUM',
      competition: 'LOW',
      risk: 'MEDIUM',
      transportEase: 'MODERATE',
      capitalRequiredXaf: 600_000,
      assessedAt: '2026-08-18T00:00:00.000Z',
    },
    hue: 45,
  },
  {
    slug: 'machine-scellage-sachets',
    name: 'Machine de scellage de sachets',
    description: 'Scelleuse à impulsion 300 mm pour conditionnement alimentaire et cosmétique.',
    category: 'MACHINES',
    priceCny: 380,
    moq: 5,
    weightGrams: 4_500,
    volumeCm3: 18_000,
    badges: ['LOW_MOQ', 'VERIFIED_SUPPLIER', 'FRAGILE'],
    watchPoints: [
      'Tension électrique : exigez un modèle 220 V et une prise adaptée.',
      'Pièces d’usure (résistance, téflon) à commander en même temps que la machine.',
    ],
    publishedAt: '2026-08-15T08:00:00.000Z',
    market: {
      localPriceMinXaf: 85_000,
      localPriceMaxXaf: 120_000,
      localPriceObservedAt: '2026-08-12T00:00:00.000Z',
      demand: 'MEDIUM',
      competition: 'LOW',
      risk: 'LOW',
      transportEase: 'DIFFICULT',
      capitalRequiredXaf: 800_000,
      assessedAt: '2026-08-12T00:00:00.000Z',
    },
    hue: 120,
  },
  {
    slug: 'sachets-emballage-imprimes',
    name: 'Sachets d’emballage imprimés',
    description: 'Sachets kraft avec fenêtre et fermeture zip, impression de votre logo incluse.',
    category: 'PACKAGING',
    priceCny: 0.9,
    moq: 1_000,
    weightGrams: 12,
    volumeCm3: 60,
    badges: ['LIGHT_WEIGHT', 'SMALL_VOLUME', 'CUSTOMIZABLE'],
    watchPoints: [
      'Validez un bon à tirer de l’impression : une erreur de logo rend tout le lot inutilisable.',
      'Le délai de production s’allonge avec la personnalisation : comptez deux semaines de plus.',
    ],
    publishedAt: '2026-09-17T08:00:00.000Z',
    // Appréciation de marché relevée, mais aucun prix local constaté pour l'instant.
    market: {
      demand: 'MEDIUM',
      competition: 'MEDIUM',
      risk: 'LOW',
      transportEase: 'EASY',
      capitalRequiredXaf: 200_000,
      assessedAt: '2026-09-14T00:00:00.000Z',
    },
    hue: 90,
  },
  {
    slug: 'mixeur-cuisine-multifonction',
    name: 'Mixeur de cuisine multifonction',
    description: 'Mixeur 800 W avec bol en verre et accessoires à découper.',
    category: 'HOME',
    priceCny: 110,
    moq: 20,
    weightGrams: 2_200,
    volumeCm3: 12_000,
    badges: ['LOW_MOQ', 'FRAGILE'],
    watchPoints: [
      'Bol en verre : casse fréquente sans emballage renforcé, l’inspection est vivement conseillée.',
      'Demandez la garantie proposée par le fournisseur avant d’acheter en quantité.',
    ],
    publishedAt: '2026-09-18T08:00:00.000Z',
    // Aucune donnée de marché : l'interface doit afficher l'absence, pas un chiffre inventé.
    hue: 0,
  },
];

/** Image de remplacement : un visuel neutre qui se présente comme une démonstration. */
/**
 * Photographies des produits, servies par le site depuis `public/images/produits/`.
 *
 * Elles remplacent un disque de couleur. Trois ont été changées après les avoir regardées :
 * les premières montraient des AirPods, une Apple Watch et des coques à logo Apple. Mettre
 * du matériel Apple en face d'un prix d'achat de 38 CNY laisse croire qu'on peut en acheter
 * à ce prix, ce qui est faux — et c'est une marque déposée. Celles retenues ne portent
 * aucun logo.
 *
 * Le chemin est relatif à la racine du site, donc valable aussi dans le back-office.
 */
const PHOTOS: Record<string, string> = {
  'ecouteurs-sans-fil-tws': '/images/produits/ecouteurs-tws.jpg',
  'coque-telephone-silicone': '/images/produits/coque-telephone.jpg',
  'montre-connectee-sport': '/images/produits/montre-connectee.jpg',
  'batterie-externe-10000': '/images/produits/batterie-externe.jpg',
  'sac-a-main-synthetique': '/images/produits/sac-a-main.jpg',
  'perruque-cheveux-synthetiques': '/images/produits/perruque.jpg',
  'kit-led-auto': '/images/produits/kit-led-auto.jpg',
  'machine-scellage-sachets': '/images/produits/machine-scellage.jpg',
  'sachets-emballage-imprimes': '/images/produits/sachets-imprimes.jpg',
  'mixeur-cuisine-multifonction': '/images/produits/mixeur.jpg',
};

/** Échappe les caractères interdits dans un texte SVG. */
/**
 * Insère (ou remet à jour) le catalogue de démonstration.
 * Idempotent : relancer le script ne crée pas de doublon.
 */
export async function seedCatalogDemoData(prisma: PrismaClient): Promise<number> {
  for (const demo of DEMO_PRODUCTS) {
    const purchasePriceXaf = Math.round(demo.priceCny * DEMO_RATE_CNY_TO_XAF);
    const common = {
      name: `${DEMO_PREFIX}${demo.name}`,
      description: demo.description,
      category: demo.category,
      status: 'PUBLISHED' as const,
      purchasePriceMinor: Math.round(demo.priceCny * 100),
      purchaseCurrency: 'CNY' as const,
      purchasePriceXaf,
      exchangeRate: DEMO_RATE_CNY_TO_XAF,
      exchangeRateAt: DEMO_RATE_OBSERVED_AT,
      exchangeRateSource: `${DEMO_SOURCE} (taux fictif 1 CNY = ${DEMO_RATE_CNY_TO_XAF} FCFA)`,
      moq: demo.moq,
      weightGrams: demo.weightGrams,
      volumeCm3: demo.volumeCm3,
      badges: demo.badges,
      watchPoints: demo.watchPoints,
      supplierIds: [],
      publishedAt: new Date(demo.publishedAt),
    };

    const product = await prisma.product.upsert({
      where: { slug: demo.slug },
      create: { slug: demo.slug, ...common },
      update: common,
    });

    await prisma.productImage.deleteMany({ where: { productId: product.id } });

    // Une seule photo, et non trois variantes de la même couleur : un carrousel de trois
    // images identiques annonce un choix qui n'existe pas. Sans photo, aucune ligne n'est
    // écrite, et la fiche affiche son état « pas d'image » — ce qui est exact.
    const photo = PHOTOS[demo.slug];
    if (photo) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: photo,
          alt: `Photographie d’illustration : ${demo.name.replace(DEMO_PREFIX, '')}`,
          position: 0,
        },
      });
    }

    if (demo.market) {
      const market = {
        localPriceMinXaf: demo.market.localPriceMinXaf ?? null,
        localPriceMaxXaf: demo.market.localPriceMaxXaf ?? null,
        localPriceObservedAt: demo.market.localPriceObservedAt
          ? new Date(demo.market.localPriceObservedAt)
          : null,
        localPriceSource: demo.market.localPriceObservedAt
          ? `${DEMO_SOURCE} — relevé fictif de marché`
          : null,
        localPriceProvenance: 'VERIFIED' as const,
        demand: demo.market.demand ?? null,
        competition: demo.market.competition ?? null,
        risk: demo.market.risk ?? null,
        transportEase: demo.market.transportEase ?? null,
        capitalRequiredXaf: demo.market.capitalRequiredXaf ?? null,
        assessedAt: demo.market.assessedAt ? new Date(demo.market.assessedAt) : null,
        assessmentSource: demo.market.assessedAt ? `${DEMO_SOURCE} — appréciation fictive` : null,
        assessmentProvenance: 'ESTIMATE' as const,
      };

      await prisma.productMarketData.upsert({
        where: { productId: product.id },
        create: { productId: product.id, ...market },
        update: market,
      });
    } else {
      await prisma.productMarketData.deleteMany({ where: { productId: product.id } });
    }
  }

  return DEMO_PRODUCTS.length;
}
