import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Feather } from '@/components/AppIcon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPlaceFavoriteStatusQueryKey,
  getGetPlaceFavoritesQueryKey,
  getCurrentSpecialChoices,
  getGetPlaceNotificationPreferenceQueryKey,
  getListBarSpecialsQueryKey,
  useGetPlaceNotificationPreference,
  useListBarSpecials,
  useSetPlaceNotificationPreference,
  useGetPlaceFavoriteStatus,
  useGetPublicVenue,
  useListPublicSpecials,
  useRemovePlaceFavorite,
  useSavePlaceFavorite,
} from '@workspace/api-client-react';
import { PublicSpecials } from '@/components/PublicSpecials';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/lib/auth';
import { enableDeviceNotifications, notificationsSupported } from '@/lib/notifications';

export default function PlaceDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, login } = useAuth();
  const { providerId: raw } = useLocalSearchParams<{ providerId: string }>();
  const providerId = String(raw ?? '');
  const venueQuery = useGetPublicVenue(providerId);
  const specialsQuery = useListPublicSpecials({ providerId });
  const statusQuery = useGetPlaceFavoriteStatus(providerId, {
    query: { enabled: Boolean(user) && Boolean(providerId), queryKey: getGetPlaceFavoriteStatusQueryKey(providerId) },
  });
  const done = () => {
    void qc.invalidateQueries({ queryKey: getGetPlaceFavoriteStatusQueryKey(providerId) });
    void qc.invalidateQueries({ queryKey: getGetPlaceFavoritesQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetPlaceNotificationPreferenceQueryKey(providerId) });
  };
  const save = useSavePlaceFavorite({ mutation: { onSuccess: done } });
  const remove = useRemovePlaceFavorite({ mutation: { onSuccess: done } });
  const busy = save.isPending || remove.isPending;
  const favorited = Boolean(statusQuery.data?.favorited);
  const actionError = save.isError || remove.isError;
  const linkedBarId = venueQuery.data?.linkedBarId ?? undefined;
  const ownerQuery = useListBarSpecials(linkedBarId ?? 0, {
    query: { enabled: linkedBarId !== undefined, queryKey: getListBarSpecialsQueryKey(linkedBarId ?? 0) },
  });
  const ownerCurrent = getCurrentSpecialChoices(ownerQuery.data ?? [], []);
  const prefKey = getGetPlaceNotificationPreferenceQueryKey(providerId);
  const prefQuery = useGetPlaceNotificationPreference(providerId, {
    query: { enabled: Boolean(user) && favorited && Boolean(providerId), queryKey: prefKey },
  });
  const setPref = useSetPlaceNotificationPreference();
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const alertsOn = Boolean(prefQuery.data?.enabled);
  const toggleAlerts = async () => {
    setAlertError(null);
    setAlertBusy(true);
    try {
      if (!alertsOn) await enableDeviceNotifications();
      await setPref.mutateAsync({ providerId, data: { enabled: !alertsOn } });
      await qc.invalidateQueries({ queryKey: prefKey });
    } catch (e) {
      setAlertError(e instanceof Error && e.message ? e.message : 'Couldn’t update alerts. Try again.');
    } finally {
      setAlertBusy(false);
    }
  };

  if (venueQuery.isLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (venueQuery.isError || !venueQuery.data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, gap: 10 }]}>
        <Feather name="wifi-off" size={30} color={colors.destructive} />
        <Text style={[styles.name, { color: colors.foreground, fontSize: 18 }]}>Couldn’t load this venue</Text>
        <Pressable onPress={() => void venueQuery.refetch()}><Text style={[styles.link, { color: colors.accent }]}>TRY AGAIN</Text></Pressable>
      </View>
    );
  }
  const v = venueQuery.data;
  const closed = v.businessStatus && v.businessStatus !== 'OPERATIONAL';
  const mapsHref = v.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([v.name, v.address].filter(Boolean).join(' '))}`;
  const row = (icon: 'external-link' | 'map-pin' | 'navigation', label: string, url: string) => (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={[styles.action, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Feather name={icon} size={16} color={colors.accent} />
      <Text style={[styles.link, { color: colors.foreground, flex: 1 }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pad}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>PUBLIC VENUE INFO</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{v.name}</Text>
          {v.address && <Text style={[styles.meta, { color: colors.mutedForeground }]}>{v.address}</Text>}
          {v.businessStatus && (
            <Text style={[styles.status, { color: closed ? colors.destructive : colors.accent }]}>
              {v.businessStatus.replace(/_/g, ' ')}
            </Text>
          )}
        </View>

        <View style={[styles.pad, { gap: 8 }]}>
          <Pressable
            accessibilityRole="button"
            disabled={busy || statusQuery.isLoading}
            onPress={() => {
              if (!user) { void login(); return; }
              if (favorited) remove.mutate({ providerId }); else save.mutate({ providerId });
            }}
            style={[styles.fav, { backgroundColor: favorited ? colors.muted : colors.primary, opacity: busy ? 0.7 : 1 }]}
          >
            <Feather name="heart" size={16} color={favorited ? colors.primary : colors.primaryForeground} />
            <Text style={[styles.favText, { color: favorited ? colors.foreground : colors.primaryForeground }]}>
              {!user ? 'LOG IN TO SAVE' : favorited ? 'REMOVE FAVORITE' : 'SAVE FAVORITE'}
            </Text>
          </Pressable>
          {(actionError || statusQuery.isError) && (
            <Text style={[styles.meta, { color: colors.destructive }]}>Couldn’t update your favorite. Try again.</Text>
          )}
          {v.websiteUri && row('external-link', 'Website', v.websiteUri)}
          {row('map-pin', 'Open in Google Maps', mapsHref)}
          {v.phone && row('navigation', `Call ${v.phone}`, `tel:${v.phone.replace(/[^+\d]/g, '')}`)}
        </View>

        <View style={[styles.pad, { gap: 6 }]}>
          <Text style={[styles.h2, { color: colors.foreground }]}>Hours</Text>
          {v.hours.length === 0 ? (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>Hours aren’t listed.</Text>
          ) : v.hours.map((h) => <Text key={h} style={[styles.meta, { color: colors.mutedForeground }]}>{h}</Text>)}
        </View>

        <Pressable
          testID="link-spin-specials"
          onPress={() => router.push({ pathname: '/spin', params: { providerId } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 8 }}
        >
          <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 1, color: colors.accent }}>SPIN CHECKED SPECIALS</Text>
          <Feather name="arrow-up-right" size={14} color={colors.accent} />
        </Pressable>

        {linkedBarId !== undefined && (
          <View style={[styles.pad, { gap: 8 }]}>
            <Text style={[styles.h2, { color: colors.foreground }]}>Posted by the venue owner</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              Posted by the verified owner on The Weekender, not supplied by Google. Expired specials are hidden.
            </Text>
            {ownerQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : ownerQuery.isError ? (
              <Pressable onPress={() => void ownerQuery.refetch()}><Text style={[styles.link, { color: colors.accent }]}>COULDN’T LOAD OWNER SPECIALS. TRY AGAIN</Text></Pressable>
            ) : ownerCurrent.length === 0 ? (
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>No current owner specials.</Text>
            ) : ownerCurrent.map((c) => (
              <View key={c.id} style={[styles.action, { borderColor: colors.border, backgroundColor: colors.card, flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 10, gap: 2 }]}>
                <Text style={[styles.link, { color: colors.foreground }]}>{c.name}</Text>
                {c.description ? <Text style={[styles.meta, { color: colors.mutedForeground }]}>{c.description}</Text> : null}
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>{c.expiresAt ? `Valid until ${new Date(c.expiresAt).toLocaleString()}` : 'No expiry set by the owner'}</Text>
              </View>
            ))}
            <Pressable testID="link-linked-bar" onPress={() => router.push(`/bars/${linkedBarId}` as never)}>
              <Text style={[styles.link, { color: colors.accent }]}>OPEN THE MANAGED VENUE PAGE</Text>
            </Pressable>
          </View>
        )}

        <PublicSpecials
          specials={specialsQuery.data}
          isLoading={specialsQuery.isLoading}
          isError={specialsQuery.isError}
          onRetry={() => void specialsQuery.refetch()}
        />

        <View style={[styles.pad, { gap: 8 }]}>
          <Text style={[styles.h2, { color: colors.foreground }]}>Special alerts</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            Off by default and only for saved favorites. Sent only when this place has a verified, paid owner.
          </Text>
          {!user ? (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>Log in and save this place to choose alerts.</Text>
          ) : !favorited ? (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>Save this place as a favorite to choose alerts.</Text>
          ) : !notificationsSupported() ? (
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>Alerts need the installed Weekender app, not Expo Go or web.</Text>
          ) : prefQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : prefQuery.isError ? (
            <Pressable onPress={() => void prefQuery.refetch()}><Text style={[styles.link, { color: colors.accent }]}>COULDN’T LOAD ALERT CHOICE. TRY AGAIN</Text></Pressable>
          ) : (
            <Pressable
              testID="button-place-alerts"
              accessibilityRole="button"
              disabled={alertBusy}
              onPress={() => void toggleAlerts()}
              style={[styles.fav, { backgroundColor: alertsOn ? colors.muted : colors.primary, opacity: alertBusy ? 0.7 : 1 }]}
            >
              <Feather name="zap" size={16} color={alertsOn ? colors.primary : colors.primaryForeground} />
              <Text style={[styles.favText, { color: alertsOn ? colors.foreground : colors.primaryForeground }]}>{alertsOn ? 'TURN ALERTS OFF' : 'TURN ALERTS ON'}</Text>
            </Pressable>
          )}
          {alertError && <Text style={[styles.meta, { color: colors.destructive }]}>{alertError}</Text>}
        </View>

        <Text style={[styles.meta, styles.pad, { color: colors.mutedForeground }]}>
          Venue details from Google Maps. Hours and status can change; confirm with the venue.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingVertical: 20, paddingBottom: 42, gap: 20 },
  pad: { paddingHorizontal: 20, gap: 5 },
  eyebrow: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, letterSpacing: 1.2 },
  name: { fontFamily: 'Outfit_800ExtraBold', fontSize: 30, letterSpacing: -0.6 },
  meta: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, lineHeight: 16 },
  status: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, letterSpacing: 0.8 },
  h2: { fontFamily: 'Outfit_700Bold', fontSize: 21 },
  fav: { minHeight: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  favText: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 0.8 },
  action: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  link: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 0.5 },
});
