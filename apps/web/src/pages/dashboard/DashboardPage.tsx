import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Users,
  Building2,
  Plus,
  LayoutList,
  UserCog,
  Bell,
  Zap,
  CheckCircle2,
  Clock,
  Circle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard } from '@/components/shared/StatsCard';
import { StatsSkeleton } from '@/components/shared/LoadingSkeleton';
import api from '@/lib/api';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const triggerAlertCheck = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/notifications/check');
      return data.data;
    },
    onSuccess: (data) => {
      toast.success(`Verificare completa: ${data.created} alerte noi create`);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Eroare la verificarea alertelor');
    },
  });

  const { data: vehiclesData, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles-stats'],
    queryFn: async () => {
      const { data } = await api.get('/vehicles', { params: { limit: 1 } });
      return data;
    },
  });

  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: ['drivers-stats'],
    queryFn: async () => {
      const { data } = await api.get('/drivers', { params: { limit: 1 } });
      return data;
    },
  });

  const { data: agenciesData, isLoading: agenciesLoading } = useQuery({
    queryKey: ['agencies-stats'],
    queryFn: async () => {
      const { data } = await api.get('/agencies');
      return data;
    },
    enabled: user?.role === 'SUPER_ADMIN' || user?.role === 'COUNTRY_MANAGER',
  });

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Super Administrator',
    COUNTRY_MANAGER: 'Manager pe Tara',
    AGENCY_MANAGER: 'Manager de Agentie',
  };

  const isStatsLoading = vehiclesLoading || driversLoading || (
    (user?.role === 'SUPER_ADMIN' || user?.role === 'COUNTRY_MANAGER') && agenciesLoading
  );

  const showAgencies = user?.role !== 'AGENCY_MANAGER';

  // Deterministic sparkline data (placeholder until Sprint 3 telemetry)
  const vehicleSparkData = [12, 15, 13, 18, 22, 20, 25, 24, 28, 30, 27, 32];
  const driverSparkData = [5, 7, 6, 8, 9, 8, 10, 12, 11, 13, 12, 14];
  const agencySparkData = [2, 2, 3, 3, 3, 4, 4, 5, 5, 5, 6, 6];

  const quickActions = [
    {
      label: 'Adauga Vehicul',
      description: 'Inregistreaza un vehicul nou in flota',
      href: '/fleet',
      icon: Truck,
      secondaryIcon: Plus,
    },
    {
      label: 'Adauga Sofer',
      description: 'Adauga un sofer nou in sistem',
      href: '/drivers',
      icon: Users,
      secondaryIcon: Plus,
    },
    {
      label: 'Vizualizeaza Flota',
      description: 'Vezi toate vehiculele din flota',
      href: '/fleet',
      icon: LayoutList,
      secondaryIcon: null,
    },
    {
      label: 'Notificari',
      description: 'Vezi alertele de documente si revizii',
      href: '/notifications',
      icon: Bell,
      secondaryIcon: null,
    },
    ...(user?.role === 'SUPER_ADMIN'
      ? [
        {
          label: 'Management Utilizatori',
          description: 'Administreaza utilizatorii sistemului',
          href: '/admin/users',
          icon: UserCog,
          secondaryIcon: null,
        },
      ]
      : []),
  ];

  const timeline = [
    {
      label: 'Sprint 1 Complet',
      status: 'done' as const,
      badge: true,
    },
    {
      label: 'Sprint 2: Alerte ITP/RCA + Notificari',
      status: 'done' as const,
      badge: true,
    },
    {
      label: 'Sprint 3: Harta Live GPS + Playback',
      status: 'in-progress' as const,
      badge: false,
    },
  ];

  const descriptionText = `Bun venit, ${user?.firstName}! ${roleLabels[user?.role ?? '']}${user?.agency ? ` — ${user.agency.name}` : ''}`;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Dashboard"
        description={descriptionText}
      >
        {user?.role === 'SUPER_ADMIN' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerAlertCheck.mutate()}
            disabled={triggerAlertCheck.isPending}
          >
            {triggerAlertCheck.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Verifica Alerte
          </Button>
        )}
      </PageHeader>

      {/* Stats Section */}
      {isStatsLoading ? (
        <StatsSkeleton count={showAgencies ? 3 : 2} />
      ) : (
        <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${showAgencies ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          <StatsCard
            title="Vehicule"
            value={vehiclesData?.total ?? '-'}
            icon={Truck}
            color="blue"
            sparkData={vehicleSparkData}
            className="animate-fade-in-up stagger-1"
          />
          <StatsCard
            title="Soferi"
            value={driversData?.total ?? '-'}
            icon={Users}
            color="green"
            sparkData={driverSparkData}
            className="animate-fade-in-up stagger-2"
          />
          {showAgencies && (
            <StatsCard
              title="Agentii"
              value={agenciesData?.total ?? agenciesData?.data?.length ?? '-'}
              icon={Building2}
              color="purple"
              sparkData={agencySparkData}
              className="animate-fade-in-up stagger-3"
            />
          )}
        </div>
      )}

      {/* Quick Actions + System Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card className="animate-fade-in-up stagger-4">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10">
                <Zap className="h-4 w-4 text-teal-500" />
              </div>
              Actiuni Rapide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.href}
                className="group flex items-center gap-4 rounded-lg border border-transparent p-3 transition-all duration-200 hover:border-border hover:bg-muted/50 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                  {action.secondaryIcon ? (
                    <div className="relative">
                      <action.icon className="h-5 w-5 text-primary" />
                      <action.secondaryIcon className="absolute -right-1.5 -top-1.5 h-3 w-3 text-primary" />
                    </div>
                  ) : (
                    <action.icon className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
                <svg
                  className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* System Info */}
        <Card className="animate-fade-in-up stagger-5">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              Informatii Sistem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-0">
              {timeline.map((item, index) => (
                <div key={item.label} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Vertical connector line */}
                  {index < timeline.length - 1 && (
                    <div className="absolute left-[11px] top-6 h-full w-px bg-border" />
                  )}
                  {/* Dot indicator */}
                  <div className="relative z-10 mt-0.5 shrink-0">
                    {item.status === 'done' ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : item.status === 'in-progress' ? (
                      <div className="flex h-6 w-6 items-center justify-center">
                        <div className="h-3 w-3 rounded-full border-2 border-teal-500 bg-teal-500/20" />
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center">
                        <Circle className="h-3 w-3 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex flex-1 items-center gap-2 pt-0.5">
                    <span
                      className={
                        item.status === 'done'
                          ? 'text-sm font-semibold text-foreground'
                          : item.status === 'in-progress'
                            ? 'text-sm font-medium text-foreground/80'
                            : 'text-sm text-muted-foreground'
                      }
                    >
                      {item.label}
                    </span>
                    {item.badge && (
                      <Badge variant="secondary" className="text-xs">
                        Complet
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
