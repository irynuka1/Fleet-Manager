import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/auth.store';
import api from '../lib/api';
import { colors } from '../lib/colors';

interface Stats {
  vehicles: number;
  drivers: number;
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrator',
  COUNTRY_MANAGER: 'Manager pe Tara',
  AGENCY_MANAGER: 'Manager de Agentie',
};

export default function DashboardScreen() {
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<Stats>({ vehicles: 0, drivers: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [vehiclesRes, driversRes, notifRes] = await Promise.all([
        api.get('/vehicles', { params: { limit: 1 } }),
        api.get('/drivers', { params: { limit: 1 } }),
        api.get('/notifications/count'),
      ]);
      setStats({
        vehicles: vehiclesRes.data.total || 0,
        drivers: driversRes.data.total || 0,
      });
      setUnreadCount(notifRes.data.data?.count || 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Welcome */}
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeTop}>
          <View>
            <Text style={styles.welcomeText}>Bun venit,</Text>
            <Text style={styles.welcomeName}>{user?.firstName} {user?.lastName}</Text>
            <Text style={styles.welcomeRole}>
              {roleLabels[user?.role ?? '']}
              {user?.agency ? ` — ${user.agency.name}` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="car" size={22} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>{stats.vehicles}</Text>
          <Text style={styles.statLabel}>Vehicule</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name="people" size={22} color={colors.success} />
          </View>
          <Text style={styles.statValue}>{stats.drivers}</Text>
          <Text style={styles.statLabel}>Soferi</Text>
        </View>
      </View>

      {/* Alerts summary */}
      <TouchableOpacity style={styles.alertCard} activeOpacity={0.7}>
        <View style={styles.alertLeft}>
          <View style={[styles.alertIcon, { backgroundColor: unreadCount > 0 ? colors.warning + '20' : colors.success + '20' }]}>
            <Ionicons
              name={unreadCount > 0 ? 'warning' : 'checkmark-circle'}
              size={24}
              color={unreadCount > 0 ? colors.warning : colors.success}
            />
          </View>
          <View>
            <Text style={styles.alertTitle}>
              {unreadCount > 0 ? `${unreadCount} alerte active` : 'Totul in regula'}
            </Text>
            <Text style={styles.alertSubtitle}>
              {unreadCount > 0
                ? 'Verificati notificarile pentru detalii'
                : 'Nicio alerta de documente sau revizii'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  welcomeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcomeText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  welcomeName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  welcomeRole: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  logoutBtn: {
    padding: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  alertSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
