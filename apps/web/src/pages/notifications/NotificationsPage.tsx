import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  FileWarning,
  ShieldAlert,
  Wrench,
  CreditCard,
  HeartPulse,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

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

const TYPE_LABELS: Record<string, string> = {
  ITP_EXPIRING: 'ITP',
  RCA_EXPIRING: 'RCA',
  REVISION_DUE: 'Revizie',
  DRIVER_LICENSE_EXPIRING: 'Permis',
  DRIVER_MEDICAL_EXPIRING: 'Fisa medicala',
};

// ---------------------------------------------------------------------------
// Filter type
// ---------------------------------------------------------------------------

type FilterType = 'all' | 'unread' | 'read';

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <p className="text-sm text-muted-foreground">
        Pagina <span className="font-medium text-foreground">{page}</span> din{' '}
        <span className="font-medium text-foreground">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="transition-colors disabled:opacity-40"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="transition-colors disabled:opacity-40"
        >
          Urmator
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>('all');

  // -- Queries ---------------------------------------------------------------

  const { data: countData } = useQuery<UnreadCountResponse>({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/count');
      return data;
    },
  });

  const unreadCount = countData?.data?.count ?? 0;

  const {
    data: notificationsData,
    isLoading,
  } = useQuery<NotificationsResponse>({
    queryKey: ['notifications', 'page', page, filter],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (filter === 'unread') params.isRead = false;
      if (filter === 'read') params.isRead = true;
      const { data } = await api.get('/notifications', { params });
      return data;
    },
  });

  const notifications = notificationsData?.data ?? [];
  const totalPages = notificationsData?.totalPages ?? 1;
  const total = notificationsData?.total ?? 0;

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

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setPage(1);
  };

  // -- Render ----------------------------------------------------------------

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <PageHeader
        className="-mt-2 -mb-1"
        title="Notificari"
        description={`${total} notificari${unreadCount > 0 ? ` (${unreadCount} necitite)` : ''}`}
      >
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-2"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
          >
            {markAllAsReadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Marcheaza toate ca citite
          </Button>
        )}
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            {([
              { value: 'all' as FilterType, label: 'Toate' },
              { value: 'unread' as FilterType, label: 'Necitite' },
              { value: 'read' as FilterType, label: 'Citite' },
            ]).map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'transition-all duration-200',
                  filter === f.value &&
                    'bg-linear-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 shadow-md shadow-teal-500/20'
                )}
                onClick={() => handleFilterChange(f.value)}
              >
                {f.label}
                {f.value === 'unread' && unreadCount > 0 && (
                  <span className={cn(
                    'ml-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold',
                    filter === 'unread'
                      ? 'bg-white/20 text-white'
                      : 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                  )}>
                    {unreadCount}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <BellOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-muted-foreground">
                  {filter === 'unread'
                    ? 'Nicio notificare necitita'
                    : filter === 'read'
                      ? 'Nicio notificare citita'
                      : 'Nicio notificare'}
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  {filter === 'unread'
                    ? 'Ai citit toate notificarile. Bravo!'
                    : 'Vei fi notificat cand apar alerte noi.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map((notification) => {
                const { icon: Icon, color, bg } = getNotificationIcon(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-4 px-5 py-4 transition-colors duration-150 hover:bg-accent/50',
                      !notification.isRead && 'bg-teal-500/3 dark:bg-teal-500/6'
                    )}
                  >
                    {/* Icon */}
                    <div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', bg)}>
                      <Icon className={cn('h-5 w-5', color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn('text-sm leading-tight', !notification.isRead ? 'font-semibold' : 'font-medium')}>
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500 shadow-xs shadow-teal-500/40" />
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                            {notification.message}
                          </p>

                          {/* References */}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {notification.vehicle && (
                              <Badge variant="outline" className="text-[11px] font-normal">
                                {notification.vehicle.name} - {notification.vehicle.plateNumber}
                              </Badge>
                            )}
                            {notification.driver && (
                              <Badge variant="outline" className="text-[11px] font-normal">
                                {notification.driver.firstName} {notification.driver.lastName}
                              </Badge>
                            )}
                            <Badge variant="secondary" className={cn('text-[11px] font-medium', bg, color)}>
                              {TYPE_LABELS[notification.type] ?? notification.type}
                            </Badge>
                          </div>
                        </div>

                        {/* Right side: time + actions */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap">
                            {timeAgo(notification.createdAt)}
                          </span>
                          <span className="text-[11px] text-muted-foreground/40">
                            {formatDate(notification.createdAt)}
                          </span>
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => markAsReadMutation.mutate(notification.id)}
                              disabled={markAsReadMutation.isPending}
                            >
                              Citita
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {notifications.length > 0 && (
            <div className="px-5 pb-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
