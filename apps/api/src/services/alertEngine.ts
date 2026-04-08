import prisma from '../config/database';

function formatDate(date: Date): string {
  return date.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export async function runAlertCheck(): Promise<number> {
  const now = new Date();
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + 30);

  // Dedup window: don't recreate if same alert exists within last 7 days
  const dedupSince = new Date();
  dedupSince.setDate(dedupSince.getDate() - 7);

  let totalCreated = 0;

  // ─── 1. Check ITP expiring ──────────────────────────────────────
  const itpVehicles = await prisma.vehicle.findMany({
    where: {
      itpExpiryDate: {
        not: null,
        lte: thresholdDate,
      },
    },
    include: { agency: true },
  });

  for (const vehicle of itpVehicles) {
    const existing = await prisma.notification.findFirst({
      where: {
        type: 'ITP_EXPIRING',
        vehicleId: vehicle.id,
        createdAt: { gte: dedupSince },
      },
    });

    if (!existing) {
      const isPast = vehicle.itpExpiryDate! < now;
      await prisma.notification.create({
        data: {
          type: 'ITP_EXPIRING',
          title: 'ITP expira in curand',
          message: isPast
            ? `Vehiculul "${vehicle.name}" (${vehicle.plateNumber}) are ITP-ul expirat din ${formatDate(vehicle.itpExpiryDate!)}`
            : `Vehiculul "${vehicle.name}" (${vehicle.plateNumber}) are ITP-ul expirand pe ${formatDate(vehicle.itpExpiryDate!)}`,
          vehicleId: vehicle.id,
          agencyId: vehicle.agencyId,
        },
      });
      totalCreated++;
    }
  }

  // ─── 2. Check RCA expiring ─────────────────────────────────────
  const rcaVehicles = await prisma.vehicle.findMany({
    where: {
      rcaExpiryDate: {
        not: null,
        lte: thresholdDate,
      },
    },
    include: { agency: true },
  });

  for (const vehicle of rcaVehicles) {
    const existing = await prisma.notification.findFirst({
      where: {
        type: 'RCA_EXPIRING',
        vehicleId: vehicle.id,
        createdAt: { gte: dedupSince },
      },
    });

    if (!existing) {
      const isPast = vehicle.rcaExpiryDate! < now;
      await prisma.notification.create({
        data: {
          type: 'RCA_EXPIRING',
          title: 'RCA expira in curand',
          message: isPast
            ? `Vehiculul "${vehicle.name}" (${vehicle.plateNumber}) are RCA-ul expirat din ${formatDate(vehicle.rcaExpiryDate!)}`
            : `Vehiculul "${vehicle.name}" (${vehicle.plateNumber}) are RCA-ul expirand pe ${formatDate(vehicle.rcaExpiryDate!)}`,
          vehicleId: vehicle.id,
          agencyId: vehicle.agencyId,
        },
      });
      totalCreated++;
    }
  }

  // ─── 3. Check revision threshold ───────────────────────────────
  const revisionVehicles = await prisma.vehicle.findMany({
    where: {
      revisionThreshold: { not: null },
      OR: [
        {
          monitoringType: 'KILOMETERS',
          currentKm: { not: null },
        },
        {
          monitoringType: 'HOURS',
          currentHours: { not: null },
        },
      ],
    },
  });

  for (const vehicle of revisionVehicles) {
    const current = vehicle.monitoringType === 'KILOMETERS'
      ? vehicle.currentKm!
      : vehicle.currentHours!;
    const threshold = vehicle.revisionThreshold!;
    const unit = vehicle.monitoringType === 'KILOMETERS' ? 'km' : 'h';

    if (current >= threshold - 1000) {
      const existing = await prisma.notification.findFirst({
        where: {
          type: 'REVISION_DUE',
          vehicleId: vehicle.id,
          createdAt: { gte: dedupSince },
        },
      });

      if (!existing) {
        await prisma.notification.create({
          data: {
            type: 'REVISION_DUE',
            title: 'Revizie necesara',
            message: `Vehiculul "${vehicle.name}" (${vehicle.plateNumber}) se apropie de pragul de revizie (${current}/${threshold} ${unit})`,
            vehicleId: vehicle.id,
            agencyId: vehicle.agencyId,
          },
        });
        totalCreated++;
      }
    }
  }

  // ─── 4. Check driver documents expiring ────────────────────────
  const expiringDriverDocs = await prisma.driverDocument.findMany({
    where: {
      expiryDate: {
        not: null,
        lte: thresholdDate,
      },
    },
    include: {
      driver: true,
    },
  });

  for (const doc of expiringDriverDocs) {
    const notificationType = doc.type === 'DRIVING_LICENSE'
      ? 'DRIVER_LICENSE_EXPIRING' as const
      : 'DRIVER_MEDICAL_EXPIRING' as const;

    const docLabel = doc.type === 'DRIVING_LICENSE'
      ? 'Permisul de conducere'
      : 'Fisa medicala';

    const existing = await prisma.notification.findFirst({
      where: {
        type: notificationType,
        driverId: doc.driverId,
        createdAt: { gte: dedupSince },
      },
    });

    if (!existing) {
      const isPast = doc.expiryDate! < now;
      await prisma.notification.create({
        data: {
          type: notificationType,
          title: `${docLabel} expira in curand`,
          message: isPast
            ? `${docLabel} al soferului ${doc.driver.firstName} ${doc.driver.lastName} a expirat din ${formatDate(doc.expiryDate!)}`
            : `${docLabel} al soferului ${doc.driver.firstName} ${doc.driver.lastName} expira pe ${formatDate(doc.expiryDate!)}`,
          driverId: doc.driverId,
          agencyId: doc.driver.agencyId,
        },
      });
      totalCreated++;
    }
  }

  console.log(`[AlertEngine] Verificare completa. ${totalCreated} notificari noi create.`);
  return totalCreated;
}
