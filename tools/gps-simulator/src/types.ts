export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoutePath {
  points: LatLng[];
  cumulativeDistances: number[];
  totalDistance: number;
}

export interface FleetVehicle {
  id: string;
  name: string;
  plateNumber: string;
  agencyId: string;
  agency?: { name: string; city: string };
  category?: { id: string; name: string };
  drivers?: { driverId: string; driver?: { id: string; firstName: string; lastName: string } }[];
}

export function hasAssignedDriver(vehicle: FleetVehicle): boolean {
  return Array.isArray(vehicle.drivers) && vehicle.drivers.length > 0;
}
