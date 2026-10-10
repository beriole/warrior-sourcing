/**
 * DONNÉES DE DÉPART — OFFRES D'ABONNEMENT (§43).
 *
 * Contrairement aux autres seeds, celui-ci ne crée pas des lignes « DÉMO ». Les trois
 * offres du cahier des charges — Gratuit, Pro, Business — sont la structure de l'offre
 * commerciale, pas un jeu d'essai. Les **prix** ci-dessous, eux, sont des points de
 * départ à ajuster depuis le back-office : ils ne sont écrits nulle part ailleurs, et les
 * modifier ne demande aucun déploiement.
 *
 * Le script est idempotent : il crée ce qui manque et laisse intact ce qui existe déjà.
 * Il ne réécrit jamais un prix que vous auriez changé.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Offre = {
  slug: string;
  name: string;
  tagline: string;
  priceXaf: number;
  period: 'MONTHLY' | 'YEARLY';
  rights: ('SUPPLIER_CONTACTS' | 'ACADEMY_INCLUDED' | 'PRIORITY_SUPPORT' | 'UNLIMITED_SAVED_CALCULATIONS')[];
  serviceDiscountPercent: number;
  highlights: string[];
  position: number;
};

const OFFRES: Offre[] = [
  {
    slug: 'gratuit',
    name: 'Gratuit',
    tagline: 'Pour comprendre et calculer avant de s’engager.',
    priceXaf: 0,
    period: 'MONTHLY',
    rights: [],
    serviceDiscountPercent: 0,
    highlights: [
      'Catalogue des opportunités, avec le coût rendu estimé',
      'Calculateur complet, sans limite d’utilisation',
      'Formations gratuites de l’Academy',
      'Suivi de vos commandes et de vos prestations',
    ],
    position: 0,
  },
  {
    slug: 'pro',
    name: 'Pro',
    tagline: 'Pour qui importe régulièrement et veut gagner du temps.',
    priceXaf: 10_000,
    period: 'MONTHLY',
    rights: ['SUPPLIER_CONTACTS', 'UNLIMITED_SAVED_CALCULATIONS'],
    serviceDiscountPercent: 10,
    highlights: [
      'Coordonnées directes des fournisseurs vérifiés',
      'Simulations enregistrées et retrouvées à tout moment',
      '10 % de remise sur toutes les prestations',
    ],
    position: 1,
  },
  {
    slug: 'business',
    name: 'Business',
    tagline: 'Pour une activité d’importation installée.',
    priceXaf: 25_000,
    period: 'MONTHLY',
    rights: [
      'SUPPLIER_CONTACTS',
      'ACADEMY_INCLUDED',
      'PRIORITY_SUPPORT',
      'UNLIMITED_SAVED_CALCULATIONS',
    ],
    serviceDiscountPercent: 20,
    highlights: [
      'Tout ce que contient l’offre Pro',
      'Formations de l’Academy incluses',
      'Vos messages traités en priorité',
      '20 % de remise sur toutes les prestations',
    ],
    position: 2,
  },
];

async function main(): Promise<void> {
  let crees = 0;
  for (const offre of OFFRES) {
    const existante = await prisma.subscriptionPlan.findUnique({ where: { slug: offre.slug } });
    if (existante) continue;
    await prisma.subscriptionPlan.create({ data: offre });
    crees += 1;
  }

  console.log(
    crees === 0
      ? 'Offres d’abonnement déjà en place : aucun prix n’a été réécrit.'
      : `${crees} offre(s) d’abonnement créée(s). Les prix s’ajustent depuis le back-office.`,
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
