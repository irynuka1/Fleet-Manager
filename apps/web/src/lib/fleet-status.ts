export const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;
export const EXPIRY_WARNING_DAYS = 30;

const REQUIRED_VEHICLE_DOCS = ['ITP', 'RCA', 'REGISTRATION'] as const;
const REQUIRED_DRIVER_DOCS = ['DRIVING_LICENSE', 'MEDICAL_CERTIFICATE'] as const;

const VEHICLE_DOC_LABELS: Record<string, string> = {
  ITP: 'ITP',
  RCA: 'RCA',
  REGISTRATION: 'Talon / Inmatriculare',
};

const DRIVER_DOC_LABELS: Record<string, string> = {
  DRIVING_LICENSE: 'Permis conducere',
  MEDICAL_CERTIFICATE: 'Fisa medicala',
};

export interface DashboardVehicle {
  id: string;
  name: string;
  plateNumber: string;
  agencyId: string;
  monitoringType: 'KILOMETERS' | 'HOURS';
  currentKm: number | null;
  currentHours: number | null;
  revisionThreshold: number | null;
  itpExpiryDate: string | null;
  rcaExpiryDate: string | null;
  agency?: { id: string; name: string; city?: string | null };
  drivers: { driver: { id: string } }[];
  documents: { type: string; expiryDate: string | null }[];
}

export interface DashboardDriver {
  id: string;
  firstName: string;
  lastName: string;
  agencyId: string;
  documents: { type: string; expiryDate: string | null }[];
}

export interface CriticalAlert {
  id: string;
  severity: 'critical' | 'warning';
  title: string;
  message: string;
}

export function getRevisionRemaining(vehicle: DashboardVehicle): number | null {
  const threshold = vehicle.revisionThreshold;
  if (threshold == null || threshold <= 0) return null;

  if (vehicle.monitoringType === 'KILOMETERS') {
    if (vehicle.currentKm == null) return null;
    return threshold - (vehicle.currentKm % threshold);
  }

  if (vehicle.currentHours == null) return null;
  return threshold - (vehicle.currentHours % threshold);
}

export function isRevisionUrgent(vehicle: DashboardVehicle): boolean {
  const remaining = getRevisionRemaining(vehicle);
  return remaining !== null && remaining < 1000;
}

export function isVehicleOnline(
  vehicleId: string,
  hasDriver: boolean,
  telemetryMap: Record<string, { updatedAt: string }>,
): boolean {
  if (!hasDriver) return false;
  const telemetry = telemetryMap[vehicleId];
  if (!telemetry) return false;
  return Date.now() - new Date(telemetry.updatedAt).getTime() < OFFLINE_THRESHOLD_MS;
}

function daysUntil(date: string): number {
  const target = new Date(date);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isExpiringSoon(date: string | null | undefined): boolean {
  if (!date) return false;
  return daysUntil(date) <= EXPIRY_WARNING_DAYS;
}

function getVehicleDocExpiry(vehicle: DashboardVehicle, type: string): string | null {
  const doc = vehicle.documents.find((d) => d.type === type);
  if (doc?.expiryDate) return doc.expiryDate;
  if (type === 'ITP') return vehicle.itpExpiryDate;
  if (type === 'RCA') return vehicle.rcaExpiryDate;
  return null;
}

export function buildCriticalAlerts(
  vehicles: DashboardVehicle[],
  drivers: DashboardDriver[],
): CriticalAlert[] {
  const alerts: CriticalAlert[] = [];

  for (const vehicle of vehicles) {
    if (isRevisionUrgent(vehicle)) {
      const remaining = getRevisionRemaining(vehicle)!;
      const unit = vehicle.monitoringType === 'KILOMETERS' ? 'km' : 'h';
      alerts.push({
        id: `revision-${vehicle.id}`,
        severity: 'critical',
        title: 'Revizie urgenta',
        message: `${vehicle.name} (${vehicle.plateNumber}) — ${remaining.toLocaleString('ro-RO')} ${unit} ramase`,
      });
    }

    for (const docType of REQUIRED_VEHICLE_DOCS) {
      const hasDoc = vehicle.documents.some((d) => d.type === docType);
      const label = VEHICLE_DOC_LABELS[docType] ?? docType;

      if (!hasDoc) {
        alerts.push({
          id: `missing-${vehicle.id}-${docType}`,
          severity: 'critical',
          title: 'Document lipsa',
          message: `${vehicle.name} (${vehicle.plateNumber}) — ${label} neincarcat`,
        });
        continue;
      }

      const expiry = getVehicleDocExpiry(vehicle, docType);
      if (isExpiringSoon(expiry)) {
        const days = daysUntil(expiry!);
        alerts.push({
          id: `expiring-${vehicle.id}-${docType}`,
          severity: days < 0 ? 'critical' : 'warning',
          title: days < 0 ? 'Document expirat' : 'Document expira curand',
          message: `${vehicle.name} (${vehicle.plateNumber}) — ${label}${
            days < 0 ? ' expirat' : ` expira in ${days} zile`
          }`,
        });
      }
    }
  }

  for (const driver of drivers) {
    const driverName = `${driver.firstName} ${driver.lastName}`;

    for (const docType of REQUIRED_DRIVER_DOCS) {
      const doc = driver.documents.find((d) => d.type === docType);
      const label = DRIVER_DOC_LABELS[docType] ?? docType;

      if (!doc) {
        alerts.push({
          id: `driver-missing-${driver.id}-${docType}`,
          severity: 'critical',
          title: 'Document sofer lipsa',
          message: `${driverName} — ${label} neincarcat`,
        });
        continue;
      }

      if (isExpiringSoon(doc.expiryDate)) {
        const days = daysUntil(doc.expiryDate!);
        alerts.push({
          id: `driver-expiring-${driver.id}-${docType}`,
          severity: days < 0 ? 'critical' : 'warning',
          title: days < 0 ? 'Document sofer expirat' : 'Document sofer expira curand',
          message: `${driverName} — ${label}${
            days < 0 ? ' expirat' : ` expira in ${days} zile`
          }`,
        });
      }
    }
  }

  const severityOrder = { critical: 0, warning: 1 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export function countOnlineOffline(
  vehicles: DashboardVehicle[],
  telemetryMap: Record<string, { updatedAt: string }>,
  agencyId?: string | null,
) {
  const filtered = agencyId
    ? vehicles.filter((v) => v.agencyId === agencyId)
    : vehicles;

  let online = 0;
  let offline = 0;

  for (const vehicle of filtered) {
    const hasDriver = vehicle.drivers.length > 0;
    if (isVehicleOnline(vehicle.id, hasDriver, telemetryMap)) {
      online += 1;
    } else {
      offline += 1;
    }
  }

  return { online, offline, total: filtered.length };
}
