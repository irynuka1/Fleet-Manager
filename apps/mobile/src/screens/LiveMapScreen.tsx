import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { colors } from '../lib/colors';

interface LivePosition {
  id?: string;
  vehicleId: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  updatedAt: string;
  vehicle?: {
    id: string;
    name: string;
    plateNumber: string;
    agencyId: string;
  };
  name?: string;
  plateNumber?: string;
}

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

const ROMANIA_REGION: Region = {
  latitude: 45.9432,
  longitude: 24.9668,
  latitudeDelta: 5,
  longitudeDelta: 5,
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'acum';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}z`;
}

function isOnline(updatedAt: string): boolean {
  return Date.now() - new Date(updatedAt).getTime() < OFFLINE_THRESHOLD_MS;
}

export default function LiveMapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const [positions, setPositions] = useState<Record<string, LivePosition>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  // Periodic re-render for time-ago refresh
  useEffect(() => {
    const i = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  // Fetch initial positions
  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const { data } = await api.get('/telemetry/live');
        if (!cancelled) {
          const dict: Record<string, LivePosition> = {};
          for (const p of data.data) {
            dict[p.vehicleId] = p;
          }
          setPositions(dict);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    const refresh = setInterval(fetch, 60_000);
    return () => {
      cancelled = true;
      clearInterval(refresh);
    };
  }, []);

  // Socket.io live updates
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;

    (async () => {
      const socket = await connectSocket();
      if (!socket || !active) return;

      const handler = (data: any) => {
        setPositions((prev) => {
          const existing = prev[data.vehicleId];
          return {
            ...prev,
            [data.vehicleId]: {
              ...(existing ?? {}),
              vehicleId: data.vehicleId,
              lat: data.lat,
              lng: data.lng,
              speed: data.speed ?? null,
              heading: data.heading ?? null,
              updatedAt: data.updatedAt,
              vehicle: existing?.vehicle ?? {
                id: data.vehicleId,
                name: data.name,
                plateNumber: data.plateNumber,
                agencyId: '',
              },
            },
          };
        });
      };

      socket.on('telemetry:update', handler);
      cleanup = () => {
        socket.off('telemetry:update', handler);
      };
    })();

    return () => {
      active = false;
      cleanup?.();
      // keep socket alive between screens — disconnect on auth logout instead
    };
  }, []);

  const list = useMemo(() => {
    return Object.values(positions).sort((a, b) => {
      const ao = isOnline(a.updatedAt) ? 0 : 1;
      const bo = isOnline(b.updatedAt) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const an = a.vehicle?.name ?? a.name ?? '';
      const bn = b.vehicle?.name ?? b.name ?? '';
      return an.localeCompare(bn);
    });
  }, [positions]);

  const onlineCount = useMemo(
    () => list.filter((p) => isOnline(p.updatedAt)).length,
    [list]
  );

  const focusVehicle = (p: LivePosition) => {
    setSelectedId(p.vehicleId);
    mapRef.current?.animateToRegion(
      {
        latitude: p.lat,
        longitude: p.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      500
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Harta Live</Text>
        <Text style={styles.headerSubtitle}>
          {onlineCount} online / {list.length} total
        </Text>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={ROMANIA_REGION}
        >
          {list.map((p) => {
            const online = isOnline(p.updatedAt);
            return (
              <Marker
                key={p.vehicleId}
                coordinate={{ latitude: p.lat, longitude: p.lng }}
                onPress={() => setSelectedId(p.vehicleId)}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View
                  style={[
                    styles.markerOuter,
                    { backgroundColor: online ? colors.primary : '#9ca3af' },
                  ]}
                >
                  <Ionicons name="car" size={14} color="#fff" />
                </View>
              </Marker>
            );
          })}
        </MapView>
      </View>

      {/* Vehicle list */}
      <View style={styles.listContainer}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : list.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="location-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>Nicio pozitie GPS</Text>
            <Text style={styles.emptySubtext}>Porneste simulatorul GPS</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            {list.map((p) => {
              const online = isOnline(p.updatedAt);
              const isSelected = selectedId === p.vehicleId;
              const name = p.vehicle?.name ?? p.name ?? 'Vehicul';
              const plate = p.vehicle?.plateNumber ?? p.plateNumber ?? '-';
              return (
                <TouchableOpacity
                  key={p.vehicleId}
                  style={[styles.card, isSelected && styles.cardSelected]}
                  onPress={() => focusVehicle(p)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.statusDot, { backgroundColor: online ? colors.primary : '#9ca3af' }]} />
                    <Text style={styles.cardTitle} numberOfLines={1}>{name}</Text>
                  </View>
                  <Text style={styles.cardPlate}>{plate}</Text>
                  <View style={styles.cardMeta}>
                    {online && p.speed != null && (
                      <Text style={styles.cardMetaText}>{Math.round(p.speed)} km/h</Text>
                    )}
                    <Text style={styles.cardMetaText}>{timeAgo(p.updatedAt)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerOuter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  listContainer: {
    height: 110,
    paddingVertical: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    width: SCREEN_WIDTH * 0.55,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 10,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#f0fdfa',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  cardPlate: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cardMetaText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
