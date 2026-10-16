import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellOff,
  FileWarning,
  ShieldAlert,
  Wrench,
  CreditCard,
  HeartPulse,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationVehicle {
  name: string;
  plateNumber: string;
}

interface NotificationDriver {
  firstName: string;
  lastName: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  vehicleId: string | null;
  vehicle?: NotificationVehicle;
  driverId: string | null;
  driver?: NotificationDriver;
  agencyId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  success: boolean;
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UnreadCountResponse {
  success: boolean;
  data: { count: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'acum cateva secunde';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? 'acum 1 minut' : `acum ${minutes} minute`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? 'acum 1 ora' : `acum ${hours} ore`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return days === 1 ? 'acum 1 zi' : `acum ${days} zile`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return months === 1 ? 'acum 1 luna' : `acum ${months} luni`;
  }

  const years = Math.floor(months / 12);
  return years === 1 ? 'acum 1 an' : `acum ${years} ani`;
}

const NOTIFICATION_ICON_MAP: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  ITP_EXPIRING: {
    icon: FileWarning,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  RCA_EXPIRING: {
    icon: ShieldAlert,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
  REVISION_DUE: {
    icon: Wrench,
    color: 'text-teal-500',
    bg: 'bg-teal-500/10',
  },
  DRIVER_LICENSE_EXPIRING: {
    icon: CreditCard,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  DRIVER_MEDICAL_EXPIRING: {
    icon: HeartPulse,
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
  },
};

function getNotificationIcon(type: string) {
  return NOTIFICATION_ICON_MAP[type] ?? { icon: Bell, color: 'text-muted-foreground', bg: 'bg-muted' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationPanel() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // -- Queries ---------------------------------------------------------------

  const { data: countData } = useQuery<UnreadCountResponse>({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/count');
      return data;
    },
    refetchInterval: 30_000,
  });

  const unreadCount = countData?.data?.count ?? 0;

  const {
    data: notificationsData,
    isLoading: isLoadingNotifications,
  } = useQuery<NotificationsResponse>({
    queryKey: ['notifications', 'panel'],
    queryFn: async () => {
      const { data } = await api.get('/notifications', {
        params: { page: 1, limit: 20 },
      });
      return data;
    },
    enabled: open,
  });

  const notifications = notificationsData?.data ?? [];

  // -- Mutations -------------------------------------------------------------

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await api.put('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate('/notifications');
  };

  // -- Render ----------------------------------------------------------------

  return (
    <div className="relative">
      {/* Trigger */}
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        className="relative rounded-lg transition-colors duration-200 hover:bg-accent"
        aria-label="Notificari"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell className="h-[18px] w-[18px] text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-bold text-white shadow-xs shadow-teal-500/30 animate-in fade-in zoom-in duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[380px] rounded-xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-xl shadow-black/10 dark:shadow-black/30 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Notificari</h3>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-teal-500/15 px-1.5 text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                {markAllAsReadMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                Marcheaza toate ca citite
              </Button>
            )}
          </div>

          <Separator />

          {/* Content */}
          <ScrollArea className="max-h-[400px]">
            {isLoadingNotifications ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <BellOff className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">Nicio notificare</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Vei fi notificat cand apar alerte noi
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map((notification) => {
                  const { icon: Icon, color, bg } = getNotificationIcon(notification.type);
                  return (
                    <button
                      key={notification.id}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-accent/50',
                        !notification.isRead && 'bg-teal-500/3 dark:bg-teal-500/6'
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Icon */}
                      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', bg)}>
                        <Icon className={cn('h-4 w-4', color)} />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn('text-sm leading-tight', !notification.isRead ? 'font-semibold' : 'font-medium')}>
                            {notification.title}
                          </p>
                          {/* Unread dot */}
                          {!notification.isRead && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500 shadow-xs shadow-teal-500/40" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground/60">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <Separator />

          {/* Footer */}
          <div className="p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={handleViewAll}
            >
              Vezi toate notificarile
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
