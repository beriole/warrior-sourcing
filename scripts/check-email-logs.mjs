import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/api/src/generated/prisma/client.js';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
    const logs = await prisma.emailLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
    });
    console.log('EMAIL LOGS:');
    console.log(JSON.stringify(logs, null, 2));
} catch (e) {
    console.error('Error fetching logs:', e);
} finally {
    await prisma.$disconnect();
}
