import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Users,
  Building2,
  UserCog,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { ScrollArea } from '@/components/ui/scroll-area';

const mainNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'] },
  { name: 'Flota', href: '/fleet', icon: Truck, roles: ['SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'] },
  { name: 'Soferi', href: '/drivers', icon: Users, roles: ['SUPER_ADMIN', 'COUNTRY_MANAGER', 'AGENCY_MANAGER'] },
];

const adminNavigation = [
  { name: 'Agentii', href: '/admin/agencies', icon: Building2, roles: ['SUPER_ADMIN'] },
  { name: 'Utilizatori', href: '/admin/users', icon: UserCog, roles: ['SUPER_ADMIN'] },
];

export default function Sidebar() {
  const { user } = useAuthStore();

  const visibleMainItems = mainNavigation.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const visibleAdminItems = adminNavigation.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <aside className="hidden md:flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-500/20">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
          OmniKinetix
        </span>
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-sidebar-foreground/10" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-3">
          {visibleMainItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-teal-500/15 to-teal-600/5 text-sidebar-foreground shadow-sm shadow-teal-500/5'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'h-[18px] w-[18px] transition-colors duration-200',
                      isActive
                        ? 'text-primary'
                        : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
                    )}
                  />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Admin section */}
          {visibleAdminItems.length > 0 && (
            <>
              <div className="px-3 mt-6 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  Administrare
                </span>
              </div>
              {visibleAdminItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-teal-500/15 to-teal-600/5 text-sidebar-foreground shadow-sm shadow-teal-500/5'
                        : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn(
                          'h-[18px] w-[18px] transition-colors duration-200',
                          isActive
                            ? 'text-primary'
                            : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
                        )}
                      />
                      <span>{item.name}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="px-5 py-4">
        <div className="text-xs text-sidebar-foreground/30">
          v1.0
        </div>
      </div>
    </aside>
  );
}
