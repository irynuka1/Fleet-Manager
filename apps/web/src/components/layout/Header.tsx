import { Moon, Sun, LogOut, Bell, Menu } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  COUNTRY_MANAGER: 'Manager Tara',
  AGENCY_MANAGER: 'Manager Agentie',
};

const roleBadgeStyles: Record<string, string> = {
  SUPER_ADMIN: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
  COUNTRY_MANAGER: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  AGENCY_MANAGER: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

export default function Header() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?';

  return (
    <header className="flex h-16 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-30 px-6">
      {/* Left side — mobile menu button */}
      <div className="flex items-center">
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Meniu">
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-lg transition-colors duration-200 hover:bg-accent"
          aria-label="Notificari"
        >
          <Bell className="h-[18px] w-[18px] text-muted-foreground" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-lg transition-colors duration-200 hover:bg-accent"
          aria-label="Schimba tema"
        >
          {theme === 'light' ? (
            <Moon className="h-[18px] w-[18px] text-muted-foreground transition-transform duration-300" />
          ) : (
            <Sun className="h-[18px] w-[18px] text-muted-foreground transition-transform duration-300" />
          )}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors duration-200 hover:bg-accent"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-teal-500 to-teal-600 text-white text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-tight">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {user?.role && roleLabels[user.role]}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60 p-1.5">
            <DropdownMenuLabel className="px-2 py-2">
              <div className="flex flex-col space-y-1.5">
                <p className="text-sm font-semibold">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                {user?.role && (
                  <Badge
                    variant="outline"
                    className={`w-fit mt-0.5 text-[11px] font-medium ${roleBadgeStyles[user.role] ?? ''}`}
                  >
                    {roleLabels[user.role]}
                  </Badge>
                )}
              </div>
            </DropdownMenuLabel>

            {user?.agency && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-2 py-1.5 font-normal text-xs text-muted-foreground">
                  Agentie: {user.agency.name}
                </DropdownMenuLabel>
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => logout()}
              className="cursor-pointer rounded-md px-2 py-2 text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Deconectare
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
