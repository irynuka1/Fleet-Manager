import { Role } from './auth';

export enum MonitoringType {
  KILOMETERS = 'KILOMETERS',
  HOURS = 'HOURS',
}

export enum DocumentType {
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  MEDICAL_CERTIFICATE = 'MEDICAL_CERTIFICATE',
}

export interface Agency {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  agencyId: string | null;
  agency?: Agency | null;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleCategory {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { vehicles: number };
}

export interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
  categoryId: string;
  category?: VehicleCategory;
  agencyId: string;
  agency?: Agency;
  monitoringType: MonitoringType;
  currentKm: number | null;
  currentHours: number | null;
  revisionThreshold: number | null;
  itpExpiryDate: string | null;
  rcaExpiryDate: string | null;
  drivers?: DriverVehicle[];
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  agencyId: string;
  agency?: Agency;
  vehicles?: DriverVehicle[];
  documents?: DriverDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface DriverDocument {
  id: string;
  driverId: string;
  type: DocumentType;
  expiryDate: string | null;
  filePath: string | null;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriverVehicle {
  id: string;
  driverId: string;
  vehicleId: string;
  driver?: Driver;
  vehicle?: Vehicle;
  createdAt: string;
}
