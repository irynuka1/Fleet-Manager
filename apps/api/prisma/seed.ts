import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // SuperAdmin
  const hashedPassword = await bcrypt.hash('admin123', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@omnikininetix.ro' },
    update: {},
    create: {
      email: 'admin@omnikininetix.ro',
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
    where: { email: 'manager@omnikininetix.ro' },
    update: {},
    create: {
      email: 'manager@omnikininetix.ro',
      password: hashedPassword,
      firstName: 'Ion',
      lastName: 'Popescu',
      role: Role.COUNTRY_MANAGER,
    },
  });
  console.log(`Country Manager creat: ${countryManager.email}`);

  // Agency Managers demo
  const agencyManager1 = await prisma.user.upsert({
    where: { email: 'bucuresti@omnikininetix.ro' },
    update: {},
    create: {
      email: 'bucuresti@omnikininetix.ro',
      password: hashedPassword,
      firstName: 'Maria',
      lastName: 'Ionescu',
      role: Role.AGENCY_MANAGER,
      agencyId: agentiaBucuresti.id,
    },
  });

  const agencyManager2 = await prisma.user.upsert({
    where: { email: 'cluj@omnikininetix.ro' },
    update: {},
    create: {
      email: 'cluj@omnikininetix.ro',
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

  // Vehicule demo
  await prisma.vehicle.upsert({
    where: { plateNumber: 'B-123-ABC' },
    update: {},
    create: {
      name: 'Dacia Logan Service',
      plateNumber: 'B-123-ABC',
      categoryId: catMasiniAngajati.id,
      agencyId: agentiaBucuresti.id,
      monitoringType: 'KILOMETERS',
      currentKm: 45200,
      revisionThreshold: 50000,
      itpExpiryDate: new Date('2026-06-15'),
      rcaExpiryDate: new Date('2026-04-01'),
    },
  });

  await prisma.vehicle.upsert({
    where: { plateNumber: 'CJ-99-XYZ' },
    update: {},
    create: {
      name: 'Excavator CAT 320',
      plateNumber: 'CJ-99-XYZ',
      categoryId: catUtilaje.id,
      agencyId: agentiaCluj.id,
      monitoringType: 'HOURS',
      currentHours: 1800,
      revisionThreshold: 2000,
      itpExpiryDate: new Date('2026-09-01'),
      rcaExpiryDate: new Date('2026-12-01'),
    },
  });

  await prisma.vehicle.upsert({
    where: { plateNumber: 'B-456-DEF' },
    update: {},
    create: {
      name: 'Mercedes Sprinter',
      plateNumber: 'B-456-DEF',
      categoryId: catDube.id,
      agencyId: agentiaBucuresti.id,
      monitoringType: 'KILOMETERS',
      currentKm: 76500,
      revisionThreshold: 77000,
      itpExpiryDate: new Date('2026-05-20'),
      rcaExpiryDate: new Date('2026-08-15'),
    },
  });
  console.log('Vehicule demo create.');

  // Soferi demo
  const sofer1 = await prisma.driver.upsert({
    where: { id: 'a0000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'a0000000-0000-4000-8000-000000000001',
      firstName: 'Gheorghe',
      lastName: 'Dragomir',
      phone: '0721000001',
      email: 'gheorghe@email.ro',
      agencyId: agentiaBucuresti.id,
    },
  });

  const sofer2 = await prisma.driver.upsert({
    where: { id: 'a0000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: 'a0000000-0000-4000-8000-000000000002',
      firstName: 'Vasile',
      lastName: 'Rusu',
      phone: '0721000002',
      email: 'vasile@email.ro',
      agencyId: agentiaCluj.id,
    },
  });
  console.log(`Soferi creati: ${sofer1.firstName} ${sofer1.lastName}, ${sofer2.firstName} ${sofer2.lastName}`);

  console.log('Seed complet!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
