/**
 * DONNÉES DE DÉMONSTRATION — LOT SRV (prestations).
 *
 * ⚠ Les tarifs et délais de ce fichier sont FICTIFS. Ils servent à rendre l'application
 * navigable, pas à annoncer un prix réel. Les vraies prestations seront saisies depuis le
 * back-office ; tant qu'elles ne le sont pas, aucun de ces montants ne doit être repris
 * ailleurs que dans une base de démonstration (§54 : aucun chiffre inventé en production).
 *
 * Deux prestations sont volontairement « sur devis » et une autre sans délai annoncé :
 * ce sont les cas qui éprouvent la règle — l'interface doit écrire « sur devis » et
 * « délai non communiqué » plutôt que d'inventer une estimation.
 *
 * Le script est idempotent : il supprime les prestations de démonstration précédentes
 * (et elles seules), puis les recrée.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const DEMO_PREFIX = 'DÉMO — ';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type DemoService = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  category:
    | 'SUPPLIER_SEARCH'
    | 'VERIFICATION'
    | 'INSPECTION'
    | 'NEGOTIATION'
    | 'ASSISTED_PURCHASE'
    | 'SUPPLIER_PAYMENT'
    | 'CONSOLIDATION'
    | 'SHIPPING'
    | 'BRANDING'
    | 'COACHING';
  pricingMode: 'FIXED' | 'FROM' | 'QUOTE';
  priceXaf: number | null;
  leadTimeDays: number | null;
  leadTimeNote: string | null;
  deliverables: string[];
  conditions: string[];
  requirements: string[];
};

/** L'ordre suit le parcours d'une importation : chercher, vérifier, acheter, acheminer, vendre. */
const SERVICES: DemoService[] = [
  {
    slug: 'demo-srv-recherche-fournisseur',
    name: 'Recherche de fournisseur',
    summary: 'Nous cherchons des fournisseurs pour votre produit et vous remettons une liste comparée.',
    description:
      'Vous décrivez le produit recherché, sa quantité et votre budget. Nous interrogeons les plateformes et nos contacts en Chine, puis nous vous remettons une liste de fournisseurs comparés sur les mêmes critères : prix, quantité minimum, délai, capacité à personnaliser.',
    category: 'SUPPLIER_SEARCH',
    pricingMode: 'FIXED',
    priceXaf: 25_000,
    leadTimeDays: 5,
    leadTimeNote: 'Jours ouvrés à compter de la réception de votre descriptif complet.',
    deliverables: [
      'Une liste de 5 fournisseurs comparés sur les mêmes critères',
      'Le prix annoncé par chacun, avec sa date de relevé',
      'Nos réserves éventuelles sur chaque fournisseur',
    ],
    conditions: [
      'La recherche porte sur un seul produit à la fois.',
      'Nous ne garantissons pas qu’un fournisseur acceptera votre quantité.',
      'Les prix relevés sont ceux annoncés par le fournisseur, pas des prix négociés.',
    ],
    requirements: [
      'Une description du produit, avec photo ou lien si vous en avez',
      'La quantité visée',
      'Votre budget d’achat, si vous en avez un',
    ],
  },
  {
    slug: 'demo-srv-verification-fournisseur',
    name: 'Vérification de fournisseur',
    summary: 'Contrôle de l’existence légale et de l’activité réelle d’un fournisseur.',
    description:
      'Avant d’envoyer de l’argent, nous contrôlons que l’entreprise existe, qu’elle est enregistrée, et que son activité correspond à ce qu’elle annonce. Le rapport dit ce qui a été vérifié et ce qui n’a pas pu l’être.',
    category: 'VERIFICATION',
    pricingMode: 'FIXED',
    priceXaf: 15_000,
    leadTimeDays: 3,
    leadTimeNote: null,
    deliverables: [
      'Un rapport écrit, daté, disant ce qui a été contrôlé',
      'Les documents d’entreprise obtenus',
      'Notre avis : à éviter, à surveiller, ou rien à signaler',
    ],
    conditions: [
      'Une vérification constate à une date donnée : elle ne garantit pas l’avenir.',
      'Si l’entreprise est introuvable, le rapport le dit — et c’est déjà une information.',
    ],
    requirements: ['Le nom exact du fournisseur', 'Le lien de sa boutique ou sa carte de visite'],
  },
  {
    slug: 'demo-srv-inspection-marchandise',
    name: 'Inspection de marchandise',
    summary: 'Contrôle de la marchandise avant expédition : quantité, conformité, état, emballage.',
    description:
      'Un intervenant se rend chez le fournisseur avant l’expédition et contrôle ce qui part réellement. Photos, comptage, état des pièces et de l’emballage. C’est le dernier moment où un problème coûte encore peu cher.',
    category: 'INSPECTION',
    pricingMode: 'FROM',
    priceXaf: 45_000,
    leadTimeDays: 4,
    leadTimeNote: 'À compter de la prise de rendez-vous chez le fournisseur.',
    deliverables: [
      'Un rapport d’inspection avec photos datées',
      'Le comptage réel comparé à la commande',
      'La liste des écarts constatés, s’il y en a',
    ],
    conditions: [
      'L’inspection porte sur ce qui est présenté le jour du contrôle.',
      'Nous n’intervenons pas dans la négociation d’un litige : c’est une autre prestation.',
    ],
    requirements: ['L’adresse du fournisseur', 'Le bon de commande ou la facture proforma'],
  },
  {
    slug: 'demo-srv-negociation',
    name: 'Négociation avec le fournisseur',
    summary: 'Nous négocions le prix, la quantité minimum et les conditions à votre place.',
    description:
      'En mandarin, avec les codes locaux. Nous partons de votre objectif de prix et de vos limites, et nous vous rendons compte de ce qui a été obtenu — y compris quand rien n’a bougé.',
    category: 'NEGOTIATION',
    pricingMode: 'FIXED',
    priceXaf: 20_000,
    leadTimeDays: 4,
    leadTimeNote: null,
    deliverables: [
      'Le compte rendu écrit de la négociation',
      'La proposition finale du fournisseur',
      'Ce que nous n’avons pas réussi à obtenir, et pourquoi',
    ],
    conditions: [
      'Aucune baisse de prix n’est garantie : nous facturons le travail, pas un résultat.',
      'Nous ne signons rien en votre nom.',
    ],
    requirements: ['Le fournisseur et le produit concernés', 'Votre prix cible et votre limite'],
  },
  {
    slug: 'demo-srv-achat-assiste',
    name: 'Achat assisté',
    summary: 'Nous passons la commande pour vous et suivons le fournisseur jusqu’à l’expédition.',
    description:
      'De la commande à la remise au transitaire : nous écrivons au fournisseur, suivons la production, vérifions les quantités et organisons l’enlèvement.',
    category: 'ASSISTED_PURCHASE',
    pricingMode: 'FROM',
    priceXaf: 35_000,
    leadTimeDays: null,
    leadTimeNote: 'Le délai dépend du délai de production annoncé par le fournisseur.',
    deliverables: [
      'La commande passée et confirmée par écrit',
      'Le suivi de production, étape par étape',
      'La remise au transitaire, avec preuve',
    ],
    conditions: [
      'Le coût de la marchandise reste à votre charge : cette prestation couvre notre travail.',
      'Nous ne prenons pas de commission sur le prix d’achat.',
    ],
    requirements: ['Le fournisseur retenu', 'La commande exacte : référence, quantité, variantes'],
  },
  {
    slug: 'demo-srv-paiement-fournisseur',
    name: 'Paiement du fournisseur',
    summary: 'Nous réglons votre fournisseur en Chine depuis le Cameroun.',
    description:
      'Vous nous versez le montant en FCFA ; nous payons le fournisseur dans sa devise et vous remettons la preuve du virement, avec le taux appliqué et sa date.',
    category: 'SUPPLIER_PAYMENT',
    pricingMode: 'QUOTE',
    priceXaf: null,
    leadTimeDays: 2,
    leadTimeNote: null,
    deliverables: [
      'La preuve du paiement au fournisseur',
      'Le taux de change appliqué, avec sa date',
      'Le détail des frais retenus',
    ],
    conditions: [
      'Le tarif dépend du montant et de la devise : il est chiffré après étude.',
      'Nous ne réglons pas un fournisseur que nous n’avons pas pu vérifier.',
    ],
    requirements: ['La facture proforma du fournisseur', 'Ses coordonnées bancaires'],
  },
  {
    slug: 'demo-srv-consolidation',
    name: 'Consolidation',
    summary: 'Regroupement de plusieurs commandes dans un seul envoi.',
    description:
      'Vos achats chez plusieurs fournisseurs arrivent à notre entrepôt en Chine, y sont regroupés, repesés et réemballés en un seul colis. C’est souvent ce qui fait la différence sur le coût du fret.',
    category: 'CONSOLIDATION',
    pricingMode: 'FIXED',
    priceXaf: 10_000,
    leadTimeDays: 3,
    leadTimeNote: 'Après réception du dernier colis à l’entrepôt.',
    deliverables: [
      'La réception de chaque colis, confirmée avec photo',
      'Le poids et le volume réels après regroupement',
      'Le colis unique remis au transitaire',
    ],
    conditions: [
      'Le stockage est offert quinze jours, puis facturé.',
      'Nous n’ouvrons pas les colis scellés par le fournisseur sans votre accord.',
    ],
    requirements: ['Les numéros de suivi des colis attendus'],
  },
  {
    slug: 'demo-srv-transport',
    name: 'Transport vers le Cameroun',
    summary: 'Acheminement aérien ou maritime, jusqu’à Douala ou Yaoundé.',
    description:
      'Nous organisons l’expédition avec nos transitaires, suivons le colis étape par étape et vous prévenons à chaque changement. Le tarif dépend du poids facturable et du mode choisi.',
    category: 'SHIPPING',
    pricingMode: 'QUOTE',
    priceXaf: null,
    leadTimeDays: null,
    leadTimeNote: 'Le délai dépend du mode de transport : il est annoncé au devis.',
    deliverables: [
      'Le devis détaillé, avec le poids facturable retenu',
      'Le suivi du colis étape par étape',
      'La remise à Douala ou Yaoundé',
    ],
    conditions: [
      'Le tarif se calcule sur le poids facturable, pas sur le poids réel seul.',
      'Les droits de douane ne sont pas compris : ils sont dus à l’arrivée.',
    ],
    requirements: ['Le poids et les dimensions du colis', 'La ville de livraison'],
  },
  {
    slug: 'demo-srv-branding',
    name: 'Marque et personnalisation',
    summary: 'Votre logo sur le produit ou sur l’emballage.',
    description:
      'Nous trouvons un fournisseur capable de personnaliser, obtenons un échantillon et vous le montrons avant de lancer la série.',
    category: 'BRANDING',
    pricingMode: 'FROM',
    priceXaf: 50_000,
    leadTimeDays: 10,
    leadTimeNote: 'Le délai dépend de la complexité de la personnalisation.',
    deliverables: [
      'Le fichier de marquage validé avec le fournisseur',
      'Un échantillon personnalisé, photographié',
      'Le prix de la série personnalisée',
    ],
    conditions: [
      'La personnalisation augmente presque toujours la quantité minimum.',
      'L’échantillon est à votre charge et n’est pas remboursable.',
    ],
    requirements: ['Votre logo en fichier vectoriel', 'Le produit concerné'],
  },
  {
    slug: 'demo-srv-accompagnement',
    name: 'Accompagnement',
    summary: 'Une heure avec un importateur expérimenté, sur votre projet précis.',
    description:
      'Vous exposez votre projet, vos chiffres et vos doutes. Nous reprenons le calcul avec vous et vous disons ce qui nous paraît tenir — et ce qui ne tient pas.',
    category: 'COACHING',
    pricingMode: 'FIXED',
    priceXaf: 15_000,
    leadTimeDays: 2,
    leadTimeNote: 'Délai pour fixer le rendez-vous.',
    deliverables: [
      'Un entretien d’une heure',
      'Le compte rendu écrit de ce qui a été dit',
      'Les prochaines étapes conseillées',
    ],
    conditions: [
      'Un conseil n’est pas une garantie de rentabilité.',
      'L’entretien se tient en français, par téléphone ou en visioconférence.',
    ],
    requirements: ['Votre projet en quelques lignes', 'Vos chiffres, si vous en avez déjà'],
  },
];

async function main(): Promise<void> {
  const demonstrations = await prisma.serviceOffering.findMany({
    where: { slug: { startsWith: 'demo-srv-' } },
    select: { id: true },
  });
  const ids = demonstrations.map((item) => item.id);

  // Une prestation déjà commandée n'est pas supprimée : la commande du client la référence.
  const commandees = await prisma.serviceOrder.findMany({
    where: { serviceId: { in: ids } },
    select: { serviceId: true },
  });
  const protegees = new Set(commandees.map((item) => item.serviceId));
  const supprimables = ids.filter((id) => !protegees.has(id));
  await prisma.serviceOffering.deleteMany({ where: { id: { in: supprimables } } });

  const now = new Date();
  for (const [index, service] of SERVICES.entries()) {
    const donnees = {
      name: `${DEMO_PREFIX}${service.name}`,
      summary: service.summary,
      description: `${service.description} (Prestation de démonstration : le tarif et le délai affichés ne sont pas des tarifs réels.)`,
      category: service.category,
      pricingMode: service.pricingMode,
      priceXaf: service.priceXaf,
      leadTimeDays: service.leadTimeDays,
      leadTimeNote: service.leadTimeNote,
      deliverables: service.deliverables,
      conditions: service.conditions,
      requirements: service.requirements,
      position: index + 1,
      publishedAt: now,
    };
    await prisma.serviceOffering.upsert({
      where: { slug: service.slug },
      create: { slug: service.slug, ...donnees },
      update: donnees,
    });
  }

  console.log(
    `Données de démonstration créées : ${SERVICES.length} prestations fictives (préfixe « ${DEMO_PREFIX}»).`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
