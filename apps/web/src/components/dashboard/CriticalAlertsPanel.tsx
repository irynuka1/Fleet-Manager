import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronRight,
  FileWarning,
  Loader2,
  ShieldAlert,
  UserX,
  Wrench,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { CriticalAlert } from '@/lib/fleet-status';

interface CriticalAlertsPanelProps {
  alerts: CriticalAlert[];
  isLoading?: boolean;
}

const iconByTitle: Record<string, typeof AlertTriangle> = {
  'Revizie urgenta': Wrench,
  'Document lipsa': FileWarning,
  'Document expirat': ShieldAlert,
  'Document expira curand': FileWarning,
  'Document sofer lipsa': UserX,
  'Document sofer expirat': ShieldAlert,
  'Document sofer expira curand': FileWarning,
};

export default function CriticalAlertsPanel({ alerts, isLoading }: CriticalAlertsPanelProps) {
  return (
    <Card className="flex h-full min-h-[380px] flex-col border-l-[3px] border-l-red-500">
      <Link
        to="/notifications"
        className="group block border-b px-6 py-4 transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400">
              Notificari critice
            </h3>
            <p className="text-xs text-muted-foreground">
              Apasa pentru a vedea toate notificarile
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
      </Link>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <AlertTriangle className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-foreground">Nicio alerta critica</p>
            <p className="text-xs text-muted-foreground">
              Flota si documentele sunt in regula momentan.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <ul className="space-y-2 p-4">
              {alerts.map((alert) => {
                const Icon = iconByTitle[alert.title] ?? AlertTriangle;
                return (
                  <li
                    key={alert.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3',
                      alert.severity === 'critical'
                        ? 'border-red-500/20 bg-red-500/5'
                        : 'border-amber-500/20 bg-amber-500/5'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        alert.severity === 'critical'
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {alert.message}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
