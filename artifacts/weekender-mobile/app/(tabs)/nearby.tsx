import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useListBars } from '@workspace/api-client-react';
import { VenueCard } from '@/components/VenueCard';
import { useColors } from '@/hooks/useColors';
import { useDeviceLocation } from '@/context/LocationContext';
import { distanceMiles } from '@/utils/location';

export default function NearbyScreen() {
  const colors = useColors();
  const router = useRouter();
  const barsQuery = useListBars();
  const location = useDeviceLocation();

  const venues = useMemo(() => {
    if (!barsQuery.data) return [];
    return barsQuery.data
      .map((bar) => {
        const distance =
          location.coordinates && typeof bar.latitude === 'number' && typeof bar.longitude === 'number'
            ? distanceMiles(location.coordinates, {
                latitude: bar.latitude,
                longitude: bar.longitude,
              })
            : null;
        return { bar, distance };
      })
      .sort((first, second) => (first.distance ?? Infinity) - (second.distance ?? Infinity));
  }, [barsQuery.data, location.coordinates]);

  const hasPinnedVenues = venues.some((venue) => venue.distance !== null);

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={barsQuery.isRefetching}
            onRefresh={() => void barsQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>YOUR AREA</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Find the vibe nearby.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Share your location only when you want local picks.
          </Text>
        </View>

        <View style={[styles.locationPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.locationIcon, { backgroundColor: colors.accent }]}>
            <Feather name="navigation" size={20} color={colors.accentForeground} />
          </View>
          <View style={styles.locationCopy}>
            <Text style={[styles.locationTitle, { color: colors.foreground }]}>
              {location.status === 'ready' ? 'Location is active' : 'Use my location'}
            </Text>
            <Text style={[styles.locationText, { color: colors.mutedForeground }]}>
              {location.status === 'ready'
                ? 'Venues with coordinates are sorted closest first.'
                : location.error ?? 'We use it only to rank bars around you.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use my location"
            disabled={location.status === 'requesting'}
            onPress={location.requestLocation}
            style={({ pressed }) => [
              styles.locationAction,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {location.status === 'requesting' ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="crosshair" size={18} color={colors.primaryForeground} />
            )}
          </Pressable>
        </View>

        {location.status === 'denied' && !location.canAskAgain && Platform.OS !== 'web' && (
          <Pressable
            onPress={() => void Linking.openSettings()}
            style={[styles.settingsButton, { borderColor: colors.border }]}
          >
            <Feather name="settings" size={15} color={colors.accent} />
            <Text style={[styles.settingsText, { color: colors.accent }]}>Open device settings</Text>
          </Pressable>
        )}

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {location.status === 'ready' ? 'Closest spots' : 'All venues'}
          </Text>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>{venues.length} LISTED</Text>
        </View>

        {barsQuery.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : barsQuery.isError ? (
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="wifi-off" size={28} color={colors.destructive} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn’t load venues</Text>
            <Pressable onPress={() => void barsQuery.refetch()}>
              <Text style={[styles.retry, { color: colors.accent }]}>TRY AGAIN</Text>
            </Pressable>
          </View>
        ) : venues.length === 0 ? (
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="map-pin" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No venues yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Add the first neighborhood spot from the web dashboard.
            </Text>
          </View>
        ) : (
          <>
            {location.status === 'ready' && !hasPinnedVenues && (
              <View style={[styles.notice, { borderColor: colors.secondary, backgroundColor: colors.secondary + '1A' }]}>
                <Feather name="info" size={16} color={colors.secondary} />
                <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
                  Your location is ready. Venue distances will appear once bar profiles are pinned to their addresses.
                </Text>
              </View>
            )}
            <View style={styles.venueList}>
              {venues.map(({ bar, distance }) => (
                <VenueCard
                  key={bar.id}
                  bar={bar}
                  distance={distance}
                  compact
                  onPress={() => router.push({ pathname: '/bars/[barId]', params: { barId: String(bar.id) } })}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 20, paddingBottom: 112, gap: 18 },
  header: { gap: 7, marginTop: 6 },
  eyebrow: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 1.6 },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 31, letterSpacing: -0.8 },
  subtitle: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22 },
  locationPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  locationCopy: { flex: 1, gap: 3 },
  locationTitle: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  locationText: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
  locationAction: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  settingsButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  settingsText: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 0.6 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 21 },
  count: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, letterSpacing: 0.8 },
  loading: { paddingVertical: 64, alignItems: 'center' },
  venueList: { gap: 12 },
  empty: { minHeight: 174, borderWidth: 1, borderRadius: 16, padding: 22, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18 },
  emptyText: { fontFamily: 'Outfit_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  retry: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 1, marginTop: 4 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noticeText: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
});