import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap,
  Truck,
  Users,
  LayoutList,
  UserCog,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function QuickActionsMenu() {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg transition-colors duration-200 hover:bg-accent"
          aria-label="Actiuni rapide"
        >
          <Zap className="h-[18px] w-[18px] text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Actiuni Rapide
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="cursor-pointer rounded-md px-2 py-2">
          <Link to="/fleet" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Adauga Vehicul
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer rounded-md px-2 py-2">
          <Link to="/drivers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Adauga Sofer
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer rounded-md px-2 py-2">
          <Link to="/fleet" className="flex items-center gap-2">
            <LayoutList className="h-4 w-4" />
            Vizualizeaza Flota
          </Link>
        </DropdownMenuItem>

        {user?.role === 'SUPER_ADMIN' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer rounded-md px-2 py-2">
              <Link to="/admin/users" className="flex items-center gap-2">
                <UserCog className="h-4 w-4" />
                Management Utilizatori
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-md px-2 py-2"
              disabled={triggerAlertCheck.isPending}
              onClick={() => triggerAlertCheck.mutate()}
            >
              {triggerAlertCheck.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Verifica Alerte
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
