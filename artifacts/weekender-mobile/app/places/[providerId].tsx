import React from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Feather } from '@/components/AppIcon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPlaceFavoriteStatusQueryKey,
  getGetPlaceFavoritesQueryKey,
  useGetPlaceFavoriteStatus,
  useGetPublicVenue,
  useListPublicSpecials,
  useRemovePlaceFavorite,
  useSavePlaceFavorite,
} from '@workspace/api-client-react';
import { PublicSpecials } from '@/components/PublicSpecials';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/lib/auth';

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
  };
  const save = useSavePlaceFavorite({ mutation: { onSuccess: done } });
  const remove = useRemovePlaceFavorite({ mutation: { onSuccess: done } });
  const busy = save.isPending || remove.isPending;
  const favorited = Boolean(statusQuery.data?.favorited);
  const actionError = save.isError || remove.isError;

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

        <PublicSpecials
          specials={specialsQuery.data}
          isLoading={specialsQuery.isLoading}
          isError={specialsQuery.isError}
          onRetry={() => void specialsQuery.refetch()}
        />

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
