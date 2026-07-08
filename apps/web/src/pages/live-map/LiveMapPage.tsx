import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import {
  MapPin,
  Truck,
  Gauge,
  Wifi,
  WifiOff,
  Search,
  X,
  Phone,
  Building2,
  User,
} from 'lucide-react';

import api from '@/lib/api';
import { depotForCity } from '@/lib/geo';
import { cn } from '@/lib/utils';
import { connectSocket, disconnectSocket } from '@/lib/socket';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import DriverAvatar from '@/components/shared/DriverAvatar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DriverInfo {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  profilePhotoPath?: string | null;
  agency?: { city?: string | null; name?: string } | null;
}

interface VehicleInfo {
  id: string;
  name: string;
  plateNumber: string;
  agencyId?: string | null;
  agency?: { city?: string | null; name?: string } | null;
  category?: { id: string; name: string } | null;
}

interface FleetVehicle {
  id: string;
  name: string;
  plateNumber: string;
  agencyId: string;
  agency?: { city?: string | null; name?: string } | null;
  category?: { id: string; name: string } | null;
  drivers: { driver: DriverInfo }[];
}

interface MapVehicle {
  vehicleId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  updatedAt: string;
  vehicle: VehicleInfo;
  hasDriver: boolean;
}

interface TelemetryUpdatePayload {
  vehicleId: string;
  name: string;
  plateNumber: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROMANIA_CENTER: [number, number] = [45.9432, 24.9668];
const DEFAULT_ZOOM = 7;
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOnline(entry: MapVehicle): boolean {
  if (!entry.hasDriver) return false;
  return Date.now() - new Date(entry.updatedAt).getTime() < OFFLINE_THRESHOLD_MS;
}

function mergeFleetWithTelemetry(
  fleet: FleetVehicle[],
  telemetry: Record<string, MapVehicle>,
): MapVehicle[] {
  const stale = new Date(0).toISOString();

  return fleet.map((v) => {
    const live = telemetry[v.id];
    const hasDriver = v.drivers.length > 0;
    const depot = depotForCity(v.agency?.city ?? v.agency?.name);

    if (live) {
      return {
        ...live,
        hasDriver,
        vehicle: {
          id: v.id,
          name: v.name,
          plateNumber: v.plateNumber,
          agencyId: v.agencyId,
          agency: v.agency,
          category: v.category,
        },
      };
    }

    return {
      vehicleId: v.id,
      lat: depot.lat,
      lng: depot.lng,
      speed: 0,
      heading: 0,
      updatedAt: stale,
      hasDriver,
      vehicle: {
        id: v.id,
        name: v.name,
        plateNumber: v.plateNumber,
        agencyId: v.agencyId,
        agency: v.agency,
        category: v.category,
      },
    };
  });
}

function timeAgo(updatedAt: string): string {
  const diff = Date.now() - new Date(updatedAt).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `acum ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `acum ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `acum ${hours}h`;
  const days = Math.floor(hours / 24);
  return `acum ${days}z`;
}

function formatLocation(lat: number, lng: number): string {
  return `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
}

function getPrimaryDriver(fleetEntry: FleetVehicle | undefined): DriverInfo | null {
  return fleetEntry?.drivers[0]?.driver ?? null;
}

function createTruckIcon(online: boolean, heading: number = 0): L.DivIcon {
  const bgColor = online ? '#14b8a6' : '#9ca3af';
  const ringColor = online ? 'rgba(20, 184, 166, 0.25)' : 'rgba(156, 163, 175, 0.2)';
  const pulse = online
    ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:${ringColor};animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>`
    : '';

  const html = `
    <div style="position:relative;width:36px;height:36px;">
      ${pulse}
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:${bgColor};box-shadow:0 6px 16px -4px ${ringColor},0 0 0 3px currentColor;color:white;transform:rotate(${heading}deg);transition:transform 0.5s ease;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${-heading}deg);">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'omnikinetix-truck-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

// ---------------------------------------------------------------------------
// Vehicle marker
// ---------------------------------------------------------------------------

interface VehicleMarkerProps {
  position: MapVehicle;
  online: boolean;
  onMapSelect: (position: MapVehicle) => void;
}

function VehicleMarkerInner({ position: p, online, onMapSelect }: VehicleMarkerProps) {
  const snappedHeading = Math.round(p.heading / 10) * 10;
  const icon = useMemo(
    () => createTruckIcon(online, snappedHeading),
    [online, snappedHeading]
  );

  return (
    <Marker
      position={[p.lat, p.lng]}
      icon={icon}
      eventHandlers={{ click: () => onMapSelect(p) }}
    />
  );
}

const VehicleMarker = VehicleMarkerInner;

// ---------------------------------------------------------------------------
// Map side panel
// ---------------------------------------------------------------------------

interface MapDetailPanelProps {
  position: MapVehicle;
  driver: DriverInfo | null;
  online: boolean;
  onClose: () => void;
}

function MapDetailPanel({ position, driver, online, onClose }: MapDetailPanelProps) {
  const agencyLabel =
    driver?.agency?.city ?? driver?.agency?.name ?? position.vehicle?.agency?.city ?? position.vehicle?.agency?.name ?? '-';

  return (
    <div className="absolute inset-y-0 right-0 z-[1000] flex w-full max-w-sm animate-fade-in">
      <div className="ml-auto flex h-full w-full flex-col border-l border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Detalii vehicul</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Inchide">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="flex flex-col items-center gap-3 pt-2">
            {driver ? (
              <>
                <DriverAvatar
                  firstName={driver.firstName}
                  lastName={driver.lastName}
                  profilePhotoPath={driver.profilePhotoPath}
                  className="h-20 w-20"
                  fallbackClassName="text-xl"
                />
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">
                    {driver.firstName} {driver.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">Sofer asignat</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">Fara sofer</p>
                  <p className="text-sm text-muted-foreground">Vehicul neasignat</p>
                </div>
              </>
            )}

            <Badge
              variant="outline"
              className={cn(
                'gap-1.5 px-2.5 py-1',
                online
                  ? 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-400'
                  : 'border-muted-foreground/20 bg-muted text-muted-foreground'
              )}
            >
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {online ? 'Online' : 'Offline'}
            </Badge>
          </div>

          {driver && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Sofer
                </p>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-foreground">{agencyLabel}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-foreground">{driver.phone || '-'}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vehicul
            </p>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2.5">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">{position.vehicle?.name ?? 'Vehicul'}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {position.vehicle?.plateNumber ?? '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Telemetrie
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" />
                  Viteza
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {Math.round(position.speed ?? 0)} km/h
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  Locatie
                </div>
                <p className="text-xs font-medium leading-relaxed text-foreground">
                  {formatLocation(position.lat, position.lng)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Actualizat:{' '}
              {position.updatedAt === new Date(0).toISOString()
                ? '—'
                : timeAgo(position.updatedAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LiveMapPage() {
  const mapRef = useRef<LeafletMap | null>(null);

  const [telemetry, setTelemetry] = useState<Record<string, MapVehicle>>({});
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapPanelId, setMapPanelId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const { data: fleetVehicles = [], isLoading: fleetLoading } = useQuery<FleetVehicle[]>({
    queryKey: ['live-map-fleet'],
    queryFn: async () => {
      const { data } = await api.get('/vehicles', { params: { limit: 100 } });
      return data.data;
    },
    refetchInterval: 60_000,
  });

  const { data: initialPositions, isLoading: telemetryLoading } = useQuery<
    Omit<MapVehicle, 'hasDriver'>[]
  >({
    queryKey: ['telemetry-live'],
    queryFn: async () => {
      const { data } = await api.get('/telemetry/live');
      return data.data;
    },
    refetchInterval: 60_000,
  });

  const isLoading = fleetLoading || telemetryLoading;

  useEffect(() => {
    if (!initialPositions) return;
    const next: Record<string, MapVehicle> = {};
    for (const p of initialPositions) {
      next[p.vehicleId] = {
        ...p,
        hasDriver: true,
      };
    }
    setTelemetry(next);
  }, [initialPositions]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = connectSocket(token);

    const handleUpdate = (payload: TelemetryUpdatePayload) => {
      setTelemetry((prev) => {
        const existing = prev[payload.vehicleId];
        const vehicleInfo: VehicleInfo = existing?.vehicle ?? {
          id: payload.vehicleId,
          name: payload.name,
          plateNumber: payload.plateNumber,
        };
        return {
          ...prev,
          [payload.vehicleId]: {
            vehicleId: payload.vehicleId,
            lat: payload.lat,
            lng: payload.lng,
            speed: payload.speed,
            heading: payload.heading,
            updatedAt: payload.updatedAt,
            hasDriver: existing?.hasDriver ?? true,
            vehicle: {
              ...vehicleInfo,
              name: payload.name,
              plateNumber: payload.plateNumber,
            },
          },
        };
      });
    };

    socket.on('telemetry:update', handleUpdate);

    return () => {
      socket.off('telemetry:update', handleUpdate);
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const allPositions = useMemo(
    () => mergeFleetWithTelemetry(fleetVehicles, telemetry),
    [fleetVehicles, telemetry],
  );

  const filteredPositions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? allPositions.filter((p) => {
        const name = p.vehicle?.name?.toLowerCase() ?? '';
        const plate = p.vehicle?.plateNumber?.toLowerCase() ?? '';
        return name.includes(term) || plate.includes(term);
      })
      : allPositions;
    return [...list].sort((a, b) => {
      const aOnline = isOnline(a) ? 0 : 1;
      const bOnline = isOnline(b) ? 0 : 1;
      if (aOnline !== bOnline) return aOnline - bOnline;
      return (a.vehicle?.name ?? '').localeCompare(b.vehicle?.name ?? '');
    });
  }, [allPositions, search]);

  const onlineCount = useMemo(
    () => allPositions.filter((p) => isOnline(p)).length,
    [allPositions],
  );
  const totalCount = allPositions.length;

  const mapPanelPosition = useMemo(
    () => allPositions.find((p) => p.vehicleId === mapPanelId) ?? null,
    [allPositions, mapPanelId],
  );

  const mapPanelFleetEntry = useMemo(
    () => fleetVehicles.find((v) => v.id === mapPanelId),
    [fleetVehicles, mapPanelId],
  );

  const focusOn = (p: MapVehicle, openPanel = false) => {
    setSelectedId(p.vehicleId);
    setMapPanelId(openPanel ? p.vehicleId : null);
    const map = mapRef.current;
    if (map) {
      map.flyTo([p.lat, p.lng], 15, { duration: 1.2 });
    }
  };

  const handleMapMarkerSelect = (p: MapVehicle) => {
    focusOn(p, true);
  };

  const handleListSelect = (p: MapVehicle) => {
    focusOn(p, false);
  };

  const descriptionText = isLoading
    ? 'Se incarca pozitiile GPS...'
    : `${onlineCount} vehicule online / ${totalCount} total`;

  const hasAny = totalCount > 0;
  const hasFleet = fleetVehicles.length > 0;

  return (
    <div className="animate-fade-in flex h-full flex-col">
      <PageHeader title="Harta Live" description={descriptionText}>
        <Badge
          variant="secondary"
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium',
            onlineCount > 0
              ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              onlineCount > 0 ? 'bg-teal-500 animate-pulse' : 'bg-muted-foreground/50'
            )}
          />
          {onlineCount > 0 ? 'Live' : 'Inactiv'}
        </Badge>
      </PageHeader>

      <div className="grid h-[calc(100vh-12rem)] min-h-[520px] grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,30%)_1fr]">
        <Card className="flex flex-col overflow-hidden">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cauta dupa nume sau placuta..."
                className="pl-9"
              />
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-teal-500" />
                {onlineCount} online
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                {totalCount - onlineCount} offline
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!hasFleet && !isLoading ? (
              <EmptyState
                icon={MapPin}
                title="Niciun vehicul in flota"
                description="Adauga vehicule din Flota si asigneaza soferi pentru tracking live."
              />
            ) : (
              <ul className="divide-y">
                {filteredPositions.map((p, idx) => {
                  const online = isOnline(p);
                  const isSelected = selectedId === p.vehicleId;
                  return (
                    <li key={p.vehicleId}>
                      <button
                        type="button"
                        onClick={() => handleListSelect(p)}
                        className={cn(
                          'group flex w-full items-start gap-3 px-3 py-3 text-left transition-all duration-150',
                          'hover:bg-muted/50 animate-fade-in-up',
                          isSelected && 'bg-teal-500/5 ring-1 ring-inset ring-teal-500/30'
                        )}
                        style={{ animationDelay: `${Math.min(idx, 10) * 30}ms` }}
                      >
                        <div className="relative mt-0.5 shrink-0">
                          <div
                            className={cn(
                              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                              online
                                ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            <Truck className="h-4 w-4" />
                          </div>
                          <span
                            className={cn(
                              'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card',
                              online ? 'bg-teal-500 animate-pulse' : 'bg-gray-400'
                            )}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {p.vehicle?.name ?? 'Vehicul'}
                            </p>
                            <Badge
                              variant="outline"
                              className="shrink-0 px-1.5 py-0 font-mono text-[10px]"
                            >
                              {p.vehicle?.plateNumber ?? '-'}
                            </Badge>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              {online ? (
                                <Wifi className="h-3 w-3 text-teal-500" />
                              ) : (
                                <WifiOff className="h-3 w-3" />
                              )}
                              <span
                                className={cn(
                                  online
                                    ? 'font-medium text-teal-600 dark:text-teal-400'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {online ? 'Online' : 'Offline'}
                              </span>
                            </span>
                            {!p.hasDriver && (
                              <span className="text-[10px] text-muted-foreground">
                                Fara sofer
                              </span>
                            )}
                            {p.hasDriver && online && (
                              <span className="inline-flex items-center gap-1">
                                <Gauge className="h-3 w-3" />
                                {Math.round(p.speed)} km/h
                              </span>
                            )}
                            <span>
                              {!p.hasDriver
                                ? 'Parcat'
                                : p.updatedAt === new Date(0).toISOString()
                                  ? '—'
                                  : timeAgo(p.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
                {filteredPositions.length === 0 && hasAny && (
                  <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Niciun vehicul nu corespunde cautarii.
                  </li>
                )}
              </ul>
            )}
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <MapContainer
            center={ROMANIA_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom
            className="h-full w-full"
            ref={(instance) => {
              mapRef.current = instance ?? null;
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {allPositions.map((p) => (
              <VehicleMarker
                key={p.vehicleId}
                position={p}
                online={isOnline(p)}
                onMapSelect={handleMapMarkerSelect}
              />
            ))}
          </MapContainer>

          {mapPanelPosition && (
            <MapDetailPanel
              position={mapPanelPosition}
              driver={getPrimaryDriver(mapPanelFleetEntry)}
              online={isOnline(mapPanelPosition)}
              onClose={() => setMapPanelId(null)}
            />
          )}

          {!hasFleet && !isLoading && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <div className="pointer-events-auto">
                <EmptyState
                  icon={MapPin}
                  title="Niciun vehicul in flota"
                  description="Adauga vehicule din Flota si asigneaza soferi pentru tracking live."
                />
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
