import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { MapPin, Truck, Gauge, Wifi, WifiOff, Search } from 'lucide-react';

import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { connectSocket, disconnectSocket } from '@/lib/socket';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VehicleInfo {
  id: string;
  name: string;
  plateNumber: string;
  agencyId?: string | null;
  category?: { id: string; name: string } | null;
}

interface LivePosition {
  id?: string;
  vehicleId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  updatedAt: string;
  vehicle: VehicleInfo;
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

function isOnline(updatedAt: string): boolean {
  return Date.now() - new Date(updatedAt).getTime() < OFFLINE_THRESHOLD_MS;
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

function createTruckIcon(online: boolean, heading: number = 0): L.DivIcon {
  const bgColor = online ? '#14b8a6' : '#9ca3af';
  const ringColor = online ? 'rgba(20, 184, 166, 0.25)' : 'rgba(156, 163, 175, 0.2)';
  const pulse = online
    ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:${ringColor};animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>`
    : '';

  const html = `
    <div style="position:relative;width:36px;height:36px;">
      ${pulse}
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:${bgColor};box-shadow:0 6px 16px -4px ${ringColor},0 0 0 3px white;transform:rotate(${heading}deg);transition:transform 0.5s ease;">
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
// Vehicle marker (memoized so the divIcon is only recreated when relevant
// inputs change — every ~10 degrees of heading rather than every update)
// ---------------------------------------------------------------------------

interface VehicleMarkerProps {
  position: LivePosition;
  online: boolean;
  onSelect: (id: string) => void;
}

function VehicleMarkerInner({ position: p, online, onSelect }: VehicleMarkerProps) {
  // Snap heading to nearest 10 degrees to keep the icon stable across small
  // heading deltas — this dramatically reduces React + Leaflet churn.
  const snappedHeading = Math.round(p.heading / 10) * 10;
  const icon = useMemo(
    () => createTruckIcon(online, snappedHeading),
    [online, snappedHeading]
  );

  return (
    <Marker
      position={[p.lat, p.lng]}
      icon={icon}
      eventHandlers={{ click: () => onSelect(p.vehicleId) }}
    >
      <Popup>
        <div className="min-w-[180px] space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">
              {p.vehicle?.name ?? 'Vehicul'}
            </p>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                online
                  ? 'bg-teal-500/10 text-teal-700'
                  : 'bg-gray-200 text-gray-600'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  online ? 'bg-teal-500' : 'bg-gray-400'
                )}
              />
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          <p className="font-mono text-xs text-gray-500">
            {p.vehicle?.plateNumber ?? '-'}
          </p>
          <div className="space-y-1 pt-1 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500">Viteza</span>
              <span className="font-medium text-gray-900">
                {Math.round(p.speed ?? 0)} km/h
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500">Actualizat</span>
              <span className="font-medium text-gray-900">
                {timeAgo(p.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

const VehicleMarker = VehicleMarkerInner;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LiveMapPage() {
  const mapRef = useRef<LeafletMap | null>(null);

  const [positions, setPositions] = useState<Record<string, LivePosition>>({});
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Tick state forces a re-render every 30s so timeAgo + online status stay fresh.
  const [, setTick] = useState(0);

  // -------------------------------------------------------------------------
  // Initial fetch
  // -------------------------------------------------------------------------

  const { data: initialPositions, isLoading } = useQuery<LivePosition[]>({
    queryKey: ['telemetry-live'],
    queryFn: async () => {
      const { data } = await api.get('/telemetry/live');
      return data.data;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!initialPositions) return;
    // Full replace: prune vehicles that no longer exist server-side.
    // Socket updates merge into this fresh state for real-time deltas.
    const next: Record<string, LivePosition> = {};
    for (const p of initialPositions) {
      next[p.vehicleId] = p;
    }
    setPositions(next);
  }, [initialPositions]);

  // -------------------------------------------------------------------------
  // Socket connection
  // -------------------------------------------------------------------------
  // Note: SUPER_ADMIN and COUNTRY_MANAGER are auto-joined to all agency rooms
  // server-side on connection, so no client-side subscribe loop is needed.

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = connectSocket(token);

    const handleUpdate = (payload: TelemetryUpdatePayload) => {
      setPositions((prev) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Periodic re-render for time-ago labels
  // -------------------------------------------------------------------------

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const allPositions = useMemo(() => Object.values(positions), [positions]);

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
      const aOnline = isOnline(a.updatedAt) ? 0 : 1;
      const bOnline = isOnline(b.updatedAt) ? 0 : 1;
      if (aOnline !== bOnline) return aOnline - bOnline;
      return (a.vehicle?.name ?? '').localeCompare(b.vehicle?.name ?? '');
    });
  }, [allPositions, search]);

  const onlineCount = useMemo(
    () => allPositions.filter((p) => isOnline(p.updatedAt)).length,
    [allPositions]
  );
  const totalCount = allPositions.length;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const focusOn = (p: LivePosition) => {
    setSelectedId(p.vehicleId);
    const map = mapRef.current;
    if (map) {
      map.flyTo([p.lat, p.lng], 15, { duration: 1.2 });
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const descriptionText = isLoading
    ? 'Se incarca pozitiile GPS...'
    : `${onlineCount} vehicule online / ${totalCount} total`;

  const hasAny = totalCount > 0;

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
        {/* Left panel: vehicle list */}
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
            {!hasAny && !isLoading ? (
              <EmptyState
                icon={MapPin}
                title="Nicio pozitie GPS inca"
                description="Porneste simulatorul GPS pentru a vedea vehiculele pe harta."
              />
            ) : (
              <ul className="divide-y">
                {filteredPositions.map((p, idx) => {
                  const online = isOnline(p.updatedAt);
                  const isSelected = selectedId === p.vehicleId;
                  return (
                    <li key={p.vehicleId}>
                      <button
                        type="button"
                        onClick={() => focusOn(p)}
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
                            {online && (
                              <span className="inline-flex items-center gap-1">
                                <Gauge className="h-3 w-3" />
                                {Math.round(p.speed)} km/h
                              </span>
                            )}
                            <span>{timeAgo(p.updatedAt)}</span>
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

        {/* Right panel: map */}
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
                online={isOnline(p.updatedAt)}
                onSelect={setSelectedId}
              />
            ))}
          </MapContainer>

          {!hasAny && !isLoading && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
              <div className="pointer-events-auto">
                <EmptyState
                  icon={MapPin}
                  title="Nicio pozitie GPS inca"
                  description="Porneste simulatorul GPS pentru a vedea vehiculele pe harta."
                />
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
