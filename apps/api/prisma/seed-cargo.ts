/**
 * DONNÉES DE DÉMONSTRATION — TRANSITAIRES ET GRILLES (lot CARGO).
 *
 * ⚠ Tout ce qui suit est FICTIF et marqué « DÉMO — ». L'adresse d'entrepôt en particulier
 * ne correspond à aucun lieu : elle sert à montrer la forme du bloc à copier, pas à
 * expédier quoi que ce soit. Le nom de l'entrepôt porte donc le préfixe, qui s'affiche
 * en toutes lettres dans l'assistant d'adresse.
 *
 * Les tarifs sont des ordres de grandeur de démonstration. Les vrais se saisissent depuis
 * le back-office, où chaque ligne porte sa source et sa date d'effet.
 *
 * Le script est idempotent : il ne recrée pas un transitaire déjà présent, et ne réécrit
 * jamais une grille que vous auriez saisie.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO = 'DÉMO — ';

const TRANSITAIRES = [
  {
    name: `${DEMO}Groupage Guangzhou (fictif)`,
    contactName: 'Service client (démonstration)',
    contactPhone: '+237 6 70 00 00 00',
    contactEmail: 'demo@exemple.invalid',
    cities: ['Douala', 'Yaoundé'],
    modes: ['SEA', 'AIR'] as const,
    notes: 'Transitaire de démonstration. Remplacez-le par vos partenaires réels.',
    warehouseName: `${DEMO}Entrepôt Guangzhou (fictif)`,
    warehouseAddressZh: '广东省广州市白云区示例路 000 号 示例仓库 A1（演示地址，请勿使用）',
    warehouseAddressLatin:
      'Demo Warehouse A1, 000 Example Road, Baiyun District, Guangzhou, Guangdong (adresse de démonstration)',
    warehouseContactName: `${DEMO}仓库收货 (fictif)`,
    warehousePhone: '+86 000 0000 0000',
    warehouseInstructions:
      'Adresse de démonstration : elle ne reçoit rien. Saisissez l’adresse réelle de votre entrepôt depuis le back-office, rubrique Transitaires.',
    rates: [
      { mode: 'SEA' as const, unit: 'CBM' as const, unitPriceXaf: 310_000, transitDays: 45, minimumChargeXaf: 155_000 },
      { mode: 'AIR' as const, unit: 'KG' as const, unitPriceXaf: 7_200, transitDays: 10, minimumChargeXaf: 36_000 },
    ],
  },
  {
    name: `${DEMO}Express Shenzhen (fictif)`,
    contactName: 'Service client (démonstration)',
    contactPhone: '+237 6 70 00 00 01',
    contactEmail: 'demo2@exemple.invalid',
    cities: ['Douala'],
    modes: ['EXPRESS', 'AIR'] as const,
    notes: 'Transitaire de démonstration.',
    warehouseName: `${DEMO}Entrepôt Shenzhen (fictif)`,
    warehouseAddressZh: '广东省深圳市宝安区示例大道 000 号 演示仓 B2（演示地址，请勿使用）',
    warehouseAddressLatin:
      'Demo Warehouse B2, 000 Example Avenue, Bao’an District, Shenzhen, Guangdong (adresse de démonstration)',
    warehouseContactName: `${DEMO}仓库收货 (fictif)`,
    warehousePhone: '+86 000 0000 0001',
    warehouseInstructions: null,
    rates: [
      { mode: 'EXPRESS' as const, unit: 'KG' as const, unitPriceXaf: 11_500, transitDays: 5, minimumChargeXaf: 34_500 },
    ],
  },
];

async function main(): Promise<void> {
  let crees = 0;

  for (const transitaire of TRANSITAIRES) {
    const existant = await prisma.forwarder.findFirst({ where: { name: transitaire.name } });
    if (existant) continue;

    const { rates, ...donnees } = transitaire;
    const cree = await prisma.forwarder.create({
      data: { ...donnees, modes: [...donnees.modes] },
    });

    await prisma.freightRate.createMany({
      data: rates.map((rate) => ({
        forwarderId: cree.id,
        mode: rate.mode,
        unit: rate.unit,
        unitPriceXaf: rate.unitPriceXaf,
        minimumChargeXaf: rate.minimumChargeXaf,
        weightBreakKg: 0,
        transitDays: rate.transitDays,
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
        source: 'Grille de démonstration, écrite pour les tests',
      })),
    });

    crees += 1;
  }

  console.log(
    crees === 0
      ? 'Transitaires de démonstration déjà en place : aucune grille n’a été réécrite.'
      : `${crees} transitaire(s) de démonstration créé(s), avec leurs grilles et leur adresse d’entrepôt.`,
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
