import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from './src/stores/auth.store';
import { colors } from './src/lib/colors';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import LiveMapScreen from './src/screens/LiveMapScreen';

type Tab = 'dashboard' | 'live-map' | 'notifications';

function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {activeTab === 'dashboard' && (
          <DashboardScreen onNavigateToNotifications={() => setActiveTab('notifications')} />
        )}
        {activeTab === 'live-map' && <LiveMapScreen />}
        {activeTab === 'notifications' && <NotificationsScreen />}
      </View>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('dashboard')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'dashboard' ? 'grid' : 'grid-outline'}
            size={22}
            color={activeTab === 'dashboard' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>
            Dashboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('live-map')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'live-map' ? 'map' : 'map-outline'}
            size={22}
            color={activeTab === 'live-map' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === 'live-map' && styles.tabLabelActive]}>
            Harta Live
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('notifications')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'notifications' ? 'notifications' : 'notifications-outline'}
            size={22}
            color={activeTab === 'notifications' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === 'notifications' && styles.tabLabelActive]}>
            Notificari
          </Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="dark" />
    </View>
  );
}

export default function App() {
  const { isLoading, isAuthenticated, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {isAuthenticated ? <MainApp /> : <LoginScreen />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.primary,
  },
});
