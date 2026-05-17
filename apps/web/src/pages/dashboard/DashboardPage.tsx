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
  Loader2,
  ShieldCheck,
  Activity,
  MapPin,
  FileWarning,
  Wrench,
  IdCard,
  HeartPulse,
  ShieldAlert,
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

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/count');
      return data as { success: boolean; data: { count: number } };
    },
  });
  const unreadCount = countData?.data?.count ?? 0;

  const { data: livePositions } = useQuery({
    queryKey: ['telemetry-live-stats'],
    queryFn: async () => {
      const { data } = await api.get('/telemetry/live');
      return data.data as { vehicleId: string; updatedAt: string }[];
    },
    refetchInterval: 60_000,
  });

  const { data: recentAlerts } = useQuery({
    queryKey: ['notifications-recent'],
    queryFn: async () => {
      const { data } = await api.get('/notifications', {
        params: { limit: 100, isRead: 'false' },
      });
      return data.data as { id: string; type: string }[];
    },
  });

  const gpsOnline = (livePositions ?? []).filter(
    (p) => Date.now() - new Date(p.updatedAt).getTime() < 5 * 60 * 1000
  ).length;

  const alertsByType = (recentAlerts ?? []).reduce<Record<string, number>>(
    (acc, n) => {
      acc[n.type] = (acc[n.type] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const fleetHealthItems = [
    {
      label: 'ITP Expira',
      count: alertsByType['ITP_EXPIRING'] ?? 0,
      icon: FileWarning,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'RCA Expira',
      count: alertsByType['RCA_EXPIRING'] ?? 0,
      icon: ShieldAlert,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Revizie Necesara',
      count: alertsByType['REVISION_DUE'] ?? 0,
      icon: Wrench,
      color: 'text-teal-500',
      bg: 'bg-teal-500/10',
    },
    {
      label: 'Permis Expira',
      count: alertsByType['DRIVER_LICENSE_EXPIRING'] ?? 0,
      icon: IdCard,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Fisa Medicala',
      count: alertsByType['DRIVER_MEDICAL_EXPIRING'] ?? 0,
      icon: HeartPulse,
      color: 'text-pink-500',
      bg: 'bg-pink-500/10',
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

        {/* Fleet Health */}
        <Card className="animate-fade-in-up stagger-5">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10">
                <Activity className="h-4 w-4 text-teal-500" />
              </div>
              Stare Flota
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* GPS + Alerts summary */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/live-map"
                className="group flex items-center gap-3 rounded-lg border border-border/50 p-3 transition-all hover:border-border hover:bg-muted/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
                  <MapPin className="h-4 w-4 text-teal-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{gpsOnline}</p>
                  <p className="text-[11px] text-muted-foreground">GPS Online</p>
                </div>
              </Link>
              <Link
                to="/notifications"
                className="group flex items-center gap-3 rounded-lg border border-border/50 p-3 transition-all hover:border-border hover:bg-muted/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                  <Bell className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{unreadCount ?? 0}</p>
                  <p className="text-[11px] text-muted-foreground">Alerte Active</p>
                </div>
              </Link>
            </div>

            {/* Alert breakdown by type */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Distributie Alerte
              </p>
              <div className="space-y-1.5">
                {fleetHealthItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5"
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${item.bg}`}>
                      <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                    </div>
                    <span className="flex-1 text-sm text-foreground">{item.label}</span>
                    <Badge
                      variant={item.count > 0 ? 'secondary' : 'outline'}
                      className="min-w-[28px] justify-center px-1.5 py-0 text-xs font-semibold"
                    >
                      {item.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
