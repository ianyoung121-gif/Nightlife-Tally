import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Feather } from '@/components/AppIcon';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetBarFollowStatusQueryKey,
  getGetPlaceFavoriteStatusQueryKey,
  getGetPlaceFavoritesQueryKey,
  getGetUserFollowingQueryKey,
  useGetPlaceFavorites,
  useGetPublicVenue,
  useGetTrendingStats,
  useGetUserFollowing,
  useRemovePlaceFavorite,
  useUnfollowBar,
} from '@workspace/api-client-react';
import { disableDeviceNotifications, getStoredPushToken, notificationsSupported } from '@/lib/notifications';
import { useColors } from '@/hooks/useColors';
import { useDeviceLocation } from '@/context/LocationContext';
import { useAuth } from '@/lib/auth';

function PlaceFavoriteRow({ providerId, colors, onOpen, onRemove, busy }: {
  providerId: string;
  colors: ReturnType<typeof useColors>;
  onOpen: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const venue = useGetPublicVenue(providerId);
  return (
    <View style={[styles.setting, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable style={styles.settingCopy} onPress={onOpen}>
        <Text numberOfLines={1} style={[styles.settingTitle, { color: colors.foreground }]}>
          {venue.data?.name ?? (venue.isError ? 'Venue unavailable' : 'Loading venue')}
        </Text>
        <Text numberOfLines={1} style={[styles.settingDetail, { color: colors.mutedForeground }]}>
          {venue.data?.address ?? 'Google venue'}
        </Text>
      </Pressable>
      <Pressable disabled={busy} onPress={onRemove} accessibilityLabel="Remove favorite">
        <Text style={[styles.enable, { color: colors.destructive }]}>REMOVE</Text>
      </Pressable>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const statsQuery = useGetTrendingStats();
  const location = useDeviceLocation();
  const { user, isLoading, authError, login, logout, deleteAccount } = useAuth();

  const router = useRouter();
  const qc = useQueryClient();
  const userId = user?.id ?? 0;
  const followingQuery = useGetUserFollowing(userId, {
    query: { enabled: Boolean(user), queryKey: getGetUserFollowingQueryKey(userId) },
  });
  const placesQuery = useGetPlaceFavorites({
    query: { enabled: Boolean(user), queryKey: getGetPlaceFavoritesQueryKey() },
  });
  const unfollow = useUnfollowBar({
    mutation: {
      onSuccess: (_d, vars) => {
        void qc.invalidateQueries({ queryKey: getGetUserFollowingQueryKey(userId) });
        void qc.invalidateQueries({ queryKey: getGetBarFollowStatusQueryKey(vars.barId, userId) });
      },
    },
  });
  const removePlace = useRemovePlaceFavorite({
    mutation: {
      onSuccess: (_d, vars) => {
        void qc.invalidateQueries({ queryKey: getGetPlaceFavoritesQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetPlaceFavoriteStatusQueryKey(vars.providerId) });
      },
    },
  });
  const [deviceRegistered, setDeviceRegistered] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  useEffect(() => {
    void getStoredPushToken().then((t) => setDeviceRegistered(Boolean(t)));
  }, [user]);
  const removeDevice = async () => {
    setDeviceBusy(true);
    setDeviceError(null);
    try {
      await disableDeviceNotifications();
      setDeviceRegistered(false);
    } catch {
      setDeviceError('Couldn’t remove this device. Check your connection and try again.');
    } finally {
      setDeviceBusy(false);
    }
  };
  const barFavorites = followingQuery.data ?? [];
  const placeFavorites = placesQuery.data ?? [];

  const confirmAccountDeletion = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently removes your Weekender account, sessions, favorites, and notification registrations. Any venue memberships are cancelled immediately. Public venue info and anonymous community tally totals remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            void deleteAccount().catch(() => {
              Alert.alert('Could not delete account', 'Please try again or contact support.');
            });
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>YOUR NIGHT OUT</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Keep it your way.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            The Weekender keeps your tallies anonymous and your plans on your device.
          </Text>
        </View>
        <View style={[styles.setting, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.settingIcon, { backgroundColor: colors.primary + '26' }]}>
            <Feather name="user" size={18} color={colors.primary} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>{user ? `@${user.username}` : 'Your account'}</Text>
            <Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>{user ? user.email : 'Log in to keep your follows with you.'}</Text>
          </View>
          {!isLoading && <Pressable onPress={user ? logout : login}><Text style={[styles.enable, { color: colors.accent }]}>{user ? 'LOG OUT' : 'LOG IN'}</Text></Pressable>}
        </View>
        {!user && authError && (
          <Text style={[styles.authError, { color: colors.destructive }]}>{authError}</Text>
        )}
        {user && (
          <Pressable onPress={confirmAccountDeletion} style={[styles.deleteAccount, { borderColor: colors.destructive + '66' }]}>
            <Feather name="trash-2" size={15} color={colors.destructive} />
            <Text style={[styles.deleteAccountText, { color: colors.destructive }]}>DELETE ACCOUNT</Text>
          </Pressable>
        )}

        {user && (
          <View style={styles.settingList}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>Favorites</Text>
            <Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>Your account saves favorite venues only.</Text>
            {(followingQuery.isLoading || placesQuery.isLoading) && <Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>Loading favorites...</Text>}
            {(followingQuery.isError || placesQuery.isError) && (
              <Pressable onPress={() => { void followingQuery.refetch(); void placesQuery.refetch(); }}>
                <Text style={[styles.authError, { color: colors.destructive, marginTop: 0 }]}>Couldn’t load favorites. TAP TO RETRY</Text>
              </Pressable>
            )}
            {(unfollow.isError || removePlace.isError) && (
              <Text style={[styles.authError, { color: colors.destructive, marginTop: 0 }]}>Couldn’t remove that favorite. Try again.</Text>
            )}
            {!followingQuery.isLoading && !placesQuery.isLoading && barFavorites.length + placeFavorites.length === 0 && !followingQuery.isError && !placesQuery.isError && (
              <View style={[styles.setting, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="heart" size={18} color={colors.mutedForeground} />
                <Text style={[styles.settingDetail, { color: colors.mutedForeground, flex: 1 }]}>No favorites yet. Save a venue from its page.</Text>
              </View>
            )}
            {barFavorites.map((bar) => (
              <View key={`bar-${bar.id}`} style={[styles.setting, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Pressable style={styles.settingCopy} onPress={() => router.push({ pathname: '/bars/[barId]', params: { barId: String(bar.id) } })}>
                  <Text numberOfLines={1} style={[styles.settingTitle, { color: colors.foreground }]}>{bar.name}</Text>
                  {bar.address && <Text numberOfLines={1} style={[styles.settingDetail, { color: colors.mutedForeground }]}>{bar.address}</Text>}
                </Pressable>
                <Pressable disabled={unfollow.isPending} onPress={() => unfollow.mutate({ barId: bar.id, data: { userId } })} accessibilityLabel="Remove favorite">
                  <Text style={[styles.enable, { color: colors.destructive }]}>REMOVE</Text>
                </Pressable>
              </View>
            ))}
            {placeFavorites.map((p) => (
              <PlaceFavoriteRow
                key={`place-${p.providerId}`}
                providerId={p.providerId}
                colors={colors}
                busy={removePlace.isPending}
                onOpen={() => router.push({ pathname: '/places/[providerId]' as '/bars/[barId]', params: { providerId: p.providerId } as never })}
                onRemove={() => removePlace.mutate({ providerId: p.providerId })}
              />
            ))}
          </View>
        )}

        {user && notificationsSupported() && (
          <View style={[styles.setting, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent + '26' }]}>
              <Feather name="radio" size={18} color={colors.accent} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Device notifications</Text>
              <Text style={[styles.settingDetail, { color: deviceError ? colors.destructive : colors.mutedForeground }]}>
                {deviceError ?? (deviceRegistered
                  ? 'This device is registered. Turn alerts on or off per favorite venue.'
                  : 'Off. Enable alerts from a favorite venue page.')}
              </Text>
            </View>
            {deviceRegistered && (
              <Pressable disabled={deviceBusy} onPress={() => void removeDevice()}>
                <Text style={[styles.enable, { color: colors.destructive }]}>{deviceBusy ? 'WORKING' : 'REMOVE'}</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={[styles.communityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.communityIcon, { backgroundColor: colors.primary }]}>
            <Feather name="activity" size={22} color={colors.primaryForeground} />
          </View>
          <View style={styles.communityCopy}>
            <Text style={[styles.communityNumber, { color: colors.foreground }]}>
              {statsQuery.data?.totalTallies ?? '—'}
            </Text>
            <Text style={[styles.communityLabel, { color: colors.mutedForeground }]}>ANONYMOUS TALLIES IN THE COMMUNITY</Text>
          </View>
        </View>

        <View style={styles.settingList}>
          <View style={[styles.setting, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent + '26' }]}>
              <Feather name="map-pin" size={18} color={colors.accent} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Location</Text>
              <Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>
                {location.status === 'ready' ? 'Active for nearby venues and plans.' : 'Off until you choose to enable it.'}
              </Text>
            </View>
            {location.status !== 'ready' && (
              <Pressable onPress={location.requestLocation}>
                <Text style={[styles.enable, { color: colors.accent }]}>ENABLE</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.setting, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.secondary + '26' }]}>
              <Feather name="shield" size={18} color={colors.secondary} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Anonymous tallying</Text>
              <Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>
                Drinks add to the vibe — not to a personal history.
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.safety, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <Feather name="heart" size={18} color={colors.primary} />
          <View style={styles.safetyCopy}>
            <Text style={[styles.safetyTitle, { color: colors.foreground }]}>Get home safe.</Text>
            <Text style={[styles.safetyText, { color: colors.mutedForeground }]}>
              Plan your ride before your first stop. Never drink and drive.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 20, paddingBottom: 112, gap: 18 },
  header: { marginTop: 6, gap: 7 },
  eyebrow: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 1.6 },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 32, letterSpacing: -0.8 },
  subtitle: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22 },
  communityCard: { borderWidth: 1, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  communityIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  communityCopy: { flex: 1, gap: 2 },
  communityNumber: { fontFamily: 'Outfit_800ExtraBold', fontSize: 28 },
  communityLabel: { fontFamily: 'SpaceMono_700Bold', fontSize: 9, letterSpacing: 0.8 },
  settingList: { gap: 10 },
  setting: { borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  settingDetail: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
  enable: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, letterSpacing: 0.6 },
  authError: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17, marginTop: -10 },
  deleteAccount: { minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  deleteAccountText: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, letterSpacing: 0.7 },
  safety: { borderWidth: 1, borderRadius: 15, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  safetyCopy: { flex: 1, gap: 3 },
  safetyTitle: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  safetyText: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
});