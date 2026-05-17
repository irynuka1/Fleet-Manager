import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  MapPin,
  Clock,
  Route as RouteIcon,
  Loader2,
  Navigation,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import api from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
}

interface VehiclesResponse {
  data: Vehicle[];
}

interface HistoryPoint {
  id: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  createdAt: string;
}

interface HistoryResponse {
  success: boolean;
  data: HistoryPoint[];
  truncated?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toLocalInput(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Haversine distance in meters
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function totalDistanceMeters(points: HistoryPoint[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversine(points[i - 1], points[i]);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Map auto-fit helper
// ---------------------------------------------------------------------------

function FitBounds({ points }: { points: HistoryPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

// ---------------------------------------------------------------------------
// Truck divIcon
// ---------------------------------------------------------------------------

function createTruckIcon(heading: number) {
  const html = `
    <div style="
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(${heading}deg);
      transition: transform 0.2s ease-out;
    ">
      <div style="
        width: 38px;
        height: 38px;
        border-radius: 9999px;
        background: linear-gradient(135deg, #14b8a6, #0d9488);
        box-shadow: 0 4px 14px rgba(20,184,166,0.45), 0 0 0 4px rgba(20,184,166,0.18);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
    className: 'playback-truck-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

// ---------------------------------------------------------------------------
// Animated marker
// ---------------------------------------------------------------------------

interface AnimatedMarkerProps {
  points: HistoryPoint[];
  progress: number; // 0..1 over full track
}

function AnimatedMarker({ points, progress }: AnimatedMarkerProps) {
  if (points.length === 0) return null;

  // Map progress (0..1) into an interpolated position along the points array
  const n = points.length;
  if (n === 1) {
    return (
      <Marker
        position={[points[0].lat, points[0].lng]}
        icon={createTruckIcon(points[0].heading ?? 0)}
      />
    );
  }

  const clamped = Math.max(0, Math.min(1, progress));
  const exact = clamped * (n - 1);
  const idx = Math.floor(exact);
  const frac = exact - idx;
  const a = points[idx];
  const b = points[Math.min(idx + 1, n - 1)];

  const lat = a.lat + (b.lat - a.lat) * frac;
  const lng = a.lng + (b.lng - a.lng) * frac;
  const heading = b.heading ?? a.heading ?? 0;

  return <Marker position={[lat, lng]} icon={createTruckIcon(heading)} />;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PlaybackPage() {
  // Default range: now -24h .. now
  const defaults = useMemo(() => {
    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return { from: toLocalInput(past), to: toLocalInput(now) };
  }, []);

  const [vehicleId, setVehicleId] = useState<string>('');
  const [fromInput, setFromInput] = useState<string>(defaults.from);
  const [toInput, setToInput] = useState<string>(defaults.to);

  // Range used for the actually-fetched history (only updated when "Incarca" is pressed)
  const [activeRange, setActiveRange] = useState<{
    vehicleId: string;
    from: string;
    to: string;
  } | null>(null);

  // Animation state
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(2);
  const [progress, setProgress] = useState<number>(0); // 0..1
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Vehicles for picker
  const { data: vehiclesData } = useQuery<VehiclesResponse>({
    queryKey: ['playback-vehicles'],
    queryFn: async () => {
      const { data } = await api.get('/vehicles', { params: { limit: 100 } });
      return data;
    },
  });
  const vehicles = vehiclesData?.data ?? [];

  // History query
  const historyQuery = useQuery<HistoryResponse>({
    queryKey: ['telemetry-history', activeRange],
    enabled: !!activeRange,
    queryFn: async () => {
      const { vehicleId, from, to } = activeRange!;
      const { data } = await api.get(`/telemetry/${vehicleId}/history`, {
        params: {
          from: new Date(from).toISOString(),
          to: new Date(to).toISOString(),
          limit: 5000,
        },
      });
      return data;
    },
  });

  const points = historyQuery.data?.data ?? [];

  // When a new dataset is loaded, reset playback.
  // Depend ONLY on activeRange so background refetches don't reset progress.
  useEffect(() => {
    setProgress(0);
    setPlaying(false);
    lastTsRef.current = null;
  }, [activeRange]);

  // Warn when the history response was truncated by the server-side limit.
  useEffect(() => {
    if (historyQuery.data?.truncated) {
      toast.warning(
        'Numar maxim de puncte atins. Restrange intervalul pentru date complete.',
      );
    }
  }, [historyQuery.data?.truncated, historyQuery.dataUpdatedAt]);

  // Animation loop
  useEffect(() => {
    if (!playing || points.length < 2) return;

    // Compute "real" duration of the recorded track (ms)
    const first = new Date(points[0].createdAt).getTime();
    const last = new Date(points[points.length - 1].createdAt).getTime();
    const realDurationMs = Math.max(last - first, 1000);

    const tick = (ts: number) => {
      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;

      setProgress((prev) => {
        const advance = (dt * speed) / realDurationMs;
        const next = prev + advance;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [playing, points, speed]);

  // Derived values
  const polyline = useMemo<[number, number][]>(
    () => points.map((p) => [p.lat, p.lng]),
    [points]
  );

  const distanceMeters = useMemo(() => totalDistanceMeters(points), [points]);

  const currentPointIndex = useMemo(() => {
    if (points.length === 0) return 0;
    return Math.min(points.length - 1, Math.floor(progress * (points.length - 1)));
  }, [progress, points]);

  const currentPoint = points[currentPointIndex];

  const trackTimeRange = useMemo(() => {
    if (points.length === 0) return null;
    const first = new Date(points[0].createdAt);
    const last = new Date(points[points.length - 1].createdAt);
    return { first, last, durationMs: last.getTime() - first.getTime() };
  }, [points]);

  const handleLoad = () => {
    if (!vehicleId) return;
    setActiveRange({ vehicleId, from: fromInput, to: toInput });
  };

  const handleRestart = () => {
    setProgress(0);
    lastTsRef.current = null;
    setPlaying(true);
  };

  const togglePlay = () => {
    if (points.length < 2) return;
    if (progress >= 1) {
      setProgress(0);
      lastTsRef.current = null;
    }
    setPlaying((p) => !p);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 1000;
    setProgress(v);
    lastTsRef.current = null;
  };

  const speedOptions = [1, 2, 5, 10];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isInitial = !activeRange;
  const isLoading = historyQuery.isFetching;
  const hasData = points.length > 0;

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        className="-mt-2 -mb-1"
        title="Playback Traseu"
        description="Vizualizeaza istoricul deplasarii unui vehicul"
      />

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-[2fr_1.4fr_1.4fr_auto] md:items-end">
            <div className="space-y-2">
              <Label>Vehicul</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteaza vehicul" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Niciun vehicul disponibil
                    </SelectItem>
                  ) : (
                    vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} — {v.plateNumber}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="from">De la</Label>
              <Input
                id="from"
                type="datetime-local"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="to">Pana la</Label>
              <Input
                id="to"
                type="datetime-local"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
              />
            </div>

            <Button
              onClick={handleLoad}
              disabled={!vehicleId || isLoading}
              className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-md shadow-teal-500/20"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RouteIcon className="mr-2 h-4 w-4" />
              )}
              Incarca Traseu
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main content */}
      {isInitial ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Navigation}
              title="Niciun traseu incarcat"
              description="Selecteaza un vehicul si o perioada pentru a vedea traseul"
            />
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-3 text-sm text-muted-foreground">
              Se incarca traseul...
            </span>
          </CardContent>
        </Card>
      ) : !hasData ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={MapPin}
              title="Niciun punct GPS gasit"
              description="Niciun punct GPS gasit in perioada selectata"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Map + controls */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="h-[520px] w-full">
                <MapContainer
                  center={[points[0].lat, points[0].lng]}
                  zoom={13}
                  scrollWheelZoom
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Polyline
                    positions={polyline}
                    pathOptions={{
                      color: '#14b8a6',
                      weight: 3,
                      opacity: 0.85,
                    }}
                  />
                  <AnimatedMarker points={points} progress={progress} />
                  <FitBounds points={points} />
                </MapContainer>
              </div>

              {/* Playback bar */}
              <div className="border-t bg-background/50 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={togglePlay}
                    size="sm"
                    className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-md shadow-teal-500/20"
                  >
                    {playing ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        Pauza
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        {progress >= 1 ? 'Reia' : 'Start'}
                      </>
                    )}
                  </Button>
                  <Button onClick={handleRestart} size="sm" variant="outline">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restart
                  </Button>

                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={String(speed)}
                      onValueChange={(v) => setSpeed(Number(v))}
                    >
                      <SelectTrigger className="h-9 w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {speedOptions.map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            {s}x
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {Math.round(progress * 100)}%
                  </div>
                </div>

                <div className="mt-3">
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    value={Math.round(progress * 1000)}
                    onChange={handleProgressChange}
                    className="w-full accent-teal-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informatii Traseu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow
                icon={RouteIcon}
                label="Distanta totala"
                value={`${(distanceMeters / 1000).toFixed(2)} km`}
              />
              <InfoRow
                icon={MapPin}
                label="Puncte GPS"
                value={`${points.length}`}
              />
              {trackTimeRange && (
                <>
                  <InfoRow
                    icon={Clock}
                    label="Inceput"
                    value={formatDateTime(points[0].createdAt)}
                  />
                  <InfoRow
                    icon={Clock}
                    label="Sfarsit"
                    value={formatDateTime(points[points.length - 1].createdAt)}
                  />
                  <InfoRow
                    icon={Clock}
                    label="Durata"
                    value={formatDuration(trackTimeRange.durationMs)}
                  />
                </>
              )}

              <div className="h-px bg-border" />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Pozitie curenta
                </p>
                {currentPoint ? (
                  <div className="space-y-3">
                    <InfoRow
                      icon={Gauge}
                      label="Viteza"
                      value={`${Math.round(currentPoint.speed ?? 0)} km/h`}
                      highlight
                    />
                    <InfoRow
                      icon={Navigation}
                      label="Directie"
                      value={`${Math.round(currentPoint.heading ?? 0)}°`}
                    />
                    <InfoRow
                      icon={Clock}
                      label="Timp"
                      value={formatDateTime(currentPoint.createdAt)}
                    />
                    <div className="rounded-md bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground">
                      {currentPoint.lat.toFixed(5)}, {currentPoint.lng.toFixed(5)}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info row
// ---------------------------------------------------------------------------

function InfoRow({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <span
        className={
          highlight
            ? 'text-sm font-semibold text-teal-600 dark:text-teal-400 tabular-nums'
            : 'text-sm font-medium tabular-nums'
        }
      >
        {value}
      </span>
    </div>
  );
}
