import { useMemo } from 'react';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  countOnlineOffline,
  type DashboardVehicle,
} from '@/lib/fleet-status';

interface AgencyOption {
  id: string;
  name: string;
  city?: string | null;
}

interface VehicleStatusDonutProps {
  vehicles: DashboardVehicle[];
  telemetryMap: Record<string, { updatedAt: string }>;
  agencies: AgencyOption[];
  selectedAgencyId: string;
  onAgencyChange: (value: string) => void;
  showAgencyFilter: boolean;
  isLoading?: boolean;
}

export default function VehicleStatusDonut({
  vehicles,
  telemetryMap,
  agencies,
  selectedAgencyId,
  onAgencyChange,
  showAgencyFilter,
  isLoading,
}: VehicleStatusDonutProps) {
  const agencyFilter = selectedAgencyId === 'all' ? null : selectedAgencyId;

  const { online, offline, total } = useMemo(
    () => countOnlineOffline(vehicles, telemetryMap, agencyFilter),
    [vehicles, telemetryMap, agencyFilter],
  );

  const onlinePct = total === 0 ? 0 : (online / total) * 100;
  const onlineDeg = (onlinePct / 100) * 360;

  return (
    <Card className="flex h-full min-h-[380px] flex-col border-l-[3px] border-l-teal-500">
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="mb-2">
          <h3 className="text-base font-semibold text-foreground">Status vehicule</h3>
          <p className="text-xs text-muted-foreground">Online vs offline in timp real</p>
        </div>

        {showAgencyFilter && (
          <div className="mb-4">
            <Select value={selectedAgencyId} onValueChange={onAgencyChange}>
              <SelectTrigger className="w-full max-w-[240px]">
                <SelectValue placeholder="Toate agentiile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate agentiile</SelectItem>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.city ?? agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : total === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Niciun vehicul de afisat.
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <div
              className="relative h-44 w-44 rounded-full shadow-inner"
              style={{
                background: `conic-gradient(#14b8a6 0deg ${onlineDeg}deg, #d1d5db ${onlineDeg}deg 360deg)`,
              }}
            >
              <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-card shadow-xs">
                <span className="text-3xl font-bold tracking-tight text-foreground">{total}</span>
                <span className="text-xs text-muted-foreground">vehicule</span>
              </div>
            </div>

            <div className="grid w-full max-w-xs grid-cols-2 gap-3">
              <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-teal-600 dark:text-teal-400">
                  <Wifi className="h-3.5 w-3.5" />
                  Online
                </div>
                <p className="text-xl font-bold text-foreground">{online}</p>
                <p className="text-[11px] text-muted-foreground">
                  {total === 0 ? '0' : Math.round(onlinePct)}%
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <WifiOff className="h-3.5 w-3.5" />
                  Offline
                </div>
                <p className="text-xl font-bold text-foreground">{offline}</p>
                <p className="text-[11px] text-muted-foreground">
                  {total === 0 ? '0' : Math.round(100 - onlinePct)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
