import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import path from 'node:path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== 'true') {
    throw new Error(
      'Seed-ul creeaza conturi cu parole demo. ' +
      'Refuzat in production (seteaza SEED_FORCE=true daca esti sigur).',
    );
  }

  console.log('Seeding database...');

  // Destructive step is opt-in: `npm run db:seed -- --reset` or SEED_RESET=true.
  const reset = process.argv.includes('--reset') || process.env.SEED_RESET === 'true';
  if (reset) {
    console.log('Curatare flota existenta (vehicule, soferi, telemetrie, alerte)...');
    await prisma.notification.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.driver.deleteMany();
    console.log('Flota curatata.');
  }

  // SuperAdmin
  const hashedPassword = await bcrypt.hash('admin123', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@omnikinetix.ro' },
    update: {},
    create: {
      email: 'admin@omnikinetix.ro',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`SuperAdmin creat: ${superAdmin.email}`);

  // Agentii demo
  const agentiaBucuresti = await prisma.agency.upsert({
    where: { id: 'b0000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'b0000000-0000-4000-8000-000000000001',
      name: 'Agentia Bucuresti',
      address: 'Bd. Unirii 10',
      city: 'Bucuresti',
    },
  });

  const agentiaCluj = await prisma.agency.upsert({
    where: { id: 'b0000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: 'b0000000-0000-4000-8000-000000000002',
      name: 'Agentia Cluj',
      address: 'Str. Memorandumului 5',
      city: 'Cluj-Napoca',
    },
  });
  console.log(`Agentii create: ${agentiaBucuresti.name}, ${agentiaCluj.name}`);

  // Country Manager demo
  const countryManager = await prisma.user.upsert({
    where: { email: 'manager@omnikinetix.ro' },
    update: {},
    create: {
      email: 'manager@omnikinetix.ro',
      password: hashedPassword,
      firstName: 'Ion',
      lastName: 'Popescu',
      role: Role.COUNTRY_MANAGER,
    },
  });
  console.log(`Country Manager creat: ${countryManager.email}`);

  // Agency Managers demo
  const agencyManager1 = await prisma.user.upsert({
    where: { email: 'bucuresti@omnikinetix.ro' },
    update: {},
    create: {
      email: 'bucuresti@omnikinetix.ro',
      password: hashedPassword,
      firstName: 'Maria',
      lastName: 'Ionescu',
      role: Role.AGENCY_MANAGER,
      agencyId: agentiaBucuresti.id,
    },
  });

  const agencyManager2 = await prisma.user.upsert({
    where: { email: 'cluj@omnikinetix.ro' },
    update: {},
    create: {
      email: 'cluj@omnikinetix.ro',
      password: hashedPassword,
      firstName: 'Andrei',
      lastName: 'Munteanu',
      role: Role.AGENCY_MANAGER,
      agencyId: agentiaCluj.id,
    },
  });
  console.log(`Agency Managers creati: ${agencyManager1.email}, ${agencyManager2.email}`);

  // Categorii globale demo
  const catUtilaje = await prisma.vehicleCategory.upsert({
    where: { name: 'Utilaje' },
    update: {},
    create: { name: 'Utilaje', description: 'Excavatoare, buldozere, macarale' },
  });

  const catMasiniAngajati = await prisma.vehicleCategory.upsert({
    where: { name: 'Masini Angajati' },
    update: {},
    create: { name: 'Masini Angajati', description: 'Autoturisme de serviciu' },
  });

  const catDube = await prisma.vehicleCategory.upsert({
    where: { name: 'Dube Transport' },
    update: {},
    create: { name: 'Dube Transport', description: 'Dube si utilitare de transport marfa' },
  });
  console.log(`Categorii create: ${catUtilaje.name}, ${catMasiniAngajati.name}, ${catDube.name}`);

  console.log('Seed complet! (fara vehicule/soferi demo — adauga manual din aplicatie)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
