import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { colors } from '../lib/colors';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  vehicleId: string | null;
  vehicle?: { name: string; plateNumber: string } | null;
  driverId: string | null;
  driver?: { firstName: string; lastName: string } | null;
  isRead: boolean;
  createdAt: string;
}

const typeConfig: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  ITP_EXPIRING: { icon: 'document-text', color: colors.itpExpiring },
  RCA_EXPIRING: { icon: 'shield', color: colors.rcaExpiring },
  REVISION_DUE: { icon: 'construct', color: colors.revisionDue },
  DRIVER_LICENSE_EXPIRING: { icon: 'card', color: colors.licenseExpiring },
  DRIVER_MEDICAL_EXPIRING: { icon: 'heart', color: colors.medicalExpiring },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'acum';
  if (seconds < 3600) return `acum ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `acum ${Math.floor(seconds / 3600)} ore`;
  if (seconds < 604800) return `acum ${Math.floor(seconds / 86400)} zile`;
  return date.toLocaleDateString('ro-RO');
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const fetchNotifications = useCallback(async (p = 1, refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else if (p === 1) setLoading(true);

      const params: any = { page: p, limit: 20 };
      if (filter === 'unread') params.isRead = 'false';
      if (filter === 'read') params.isRead = 'true';

      const { data } = await api.get('/notifications', { params });
      setNotifications(p === 1 ? data.data : [...notifications, ...data.data]);
      setTotalPages(data.totalPages);
      setPage(p);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications(1);
  }, [filter]);

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const config = typeConfig[item.type] || { icon: 'notifications', color: colors.textMuted };

    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.isRead && styles.notifUnread]}
        onPress={() => !item.isRead && markAsRead(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, !item.isRead && styles.notifTitleUnread]}>
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
          <View style={styles.notifMeta}>
            {item.vehicle && (
              <View style={styles.metaBadge}>
                <Ionicons name="car" size={12} color={colors.textMuted} />
                <Text style={styles.metaText}>{item.vehicle.plateNumber}</Text>
              </View>
            )}
            {item.driver && (
              <View style={styles.metaBadge}>
                <Ionicons name="person" size={12} color={colors.textMuted} />
                <Text style={styles.metaText}>{item.driver.firstName} {item.driver.lastName}</Text>
              </View>
            )}
            <Text style={styles.timeText}>{timeAgo(item.createdAt)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notificari</Text>
        {hasUnread && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Marcheaza toate ca citite</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'unread', 'read'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Toate' : f === 'unread' ? 'Necitite' : 'Citite'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications(1, true)}
              tintColor={colors.primary}
            />
          }
          onEndReached={() => {
            if (page < totalPages) fetchNotifications(page + 1);
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nicio notificare</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'unread'
                  ? 'Toate notificarile au fost citite'
                  : 'Nu exista notificari momentan'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  notifCard: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifUnread: {
    backgroundColor: '#f0fdfa',
    borderColor: '#99f6e4',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  notifTitleUnread: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  notifMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  notifMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
});
