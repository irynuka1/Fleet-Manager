import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

interface RequireRoleProps {
  roles: string[];
  children: React.ReactNode;
}

export default function RequireRole({ roles, children }: RequireRoleProps) {
  const { user } = useAuthStore();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
