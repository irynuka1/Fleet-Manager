import { useQuery } from '@tanstack/react-query';
import {
  Truck,
  Users,
  Building2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard } from '@/components/shared/StatsCard';
import { StatsSkeleton } from '@/components/shared/LoadingSkeleton';
import api from '@/lib/api';

export default function DashboardPage() {
  const { user } = useAuthStore();

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

  const isStatsLoading = vehiclesLoading || driversLoading || (
    (user?.role === 'SUPER_ADMIN' || user?.role === 'COUNTRY_MANAGER') && agenciesLoading
  );

  const showAgencies = user?.role !== 'AGENCY_MANAGER';

  const vehicleSparkData = [12, 15, 13, 18, 22, 20, 25, 24, 28, 30, 27, 32];
  const driverSparkData = [5, 7, 6, 8, 9, 8, 10, 12, 11, 13, 12, 14];
  const agencySparkData = [2, 2, 3, 3, 3, 4, 4, 5, 5, 5, 6, 6];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Bun venit, ${user?.firstName}!`}
      />

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
    </div>
  );
}
