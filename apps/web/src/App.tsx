import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import AppLayout from '@/components/layout/AppLayout';
import RequireRole from '@/components/layout/RequireRole';
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import FleetPage from '@/pages/fleet/FleetPage';
import DriversPage from '@/pages/drivers/DriversPage';
import AgenciesPage from '@/pages/admin/AgenciesPage';
import UsersPage from '@/pages/admin/UsersPage';
import NotificationsPage from '@/pages/notifications/NotificationsPage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AppContent() {
  const { initialize } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []); // Only on mount - store handles subsequent changes

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/fleet" element={<FleetPage />} />
          <Route path="/drivers" element={<DriversPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/admin/agencies" element={<RequireRole roles={['SUPER_ADMIN', 'COUNTRY_MANAGER']}><AgenciesPage /></RequireRole>} />
          <Route path="/admin/users" element={<RequireRole roles={['SUPER_ADMIN']}><UsersPage /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster richColors position="bottom-right" />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
