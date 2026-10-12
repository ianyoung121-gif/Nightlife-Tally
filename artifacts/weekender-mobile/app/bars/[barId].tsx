import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Feather } from '@/components/AppIcon';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetBarFollowStatusQueryKey,
  getGetUserFollowingQueryKey,
  getGetVenueNotificationPreferenceQueryKey,
  useFollowBar,
  useGetBar,
  useGetBarFollowStatus,
  useGetVenueNotificationPreference,
  useListBarDrinks,
  useListBarSpecials,
  useListPublicSpecials,
  useSetVenueNotificationPreference,
  useTallyDrink,
  useUnfollowBar,
} from '@workspace/api-client-react';
import { PublicSpecials } from '@/components/PublicSpecials';
import { useAuth } from '@/lib/auth';
import { enableDeviceNotifications, notificationsSupported } from '@/lib/notifications';
import { DrinkIcon } from '@/components/DrinkIcon';
import { useColors } from '@/hooks/useColors';

export default function BarDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { barId: rawBarId } = useLocalSearchParams<{ barId: string }>();
  const barId = Number(rawBarId);
  const barQuery = useGetBar(barId);
  const drinksQuery = useListBarDrinks(barId);
  const specialsQuery = useListBarSpecials(barId);
  const publicSpecialsQuery = useListPublicSpecials({ barId });
  const qc = useQueryClient();
  const { user, login } = useAuth();
  const userId = user?.id ?? 0;
  const followQuery = useGetBarFollowStatus(barId, userId, {
    query: { enabled: Boolean(user) && Number.isFinite(barId), queryKey: getGetBarFollowStatusQueryKey(barId, userId) },
  });
  const following = Boolean(followQuery.data?.following);
  const refreshFollows = () => {
    void qc.invalidateQueries({ queryKey: getGetBarFollowStatusQueryKey(barId, userId) });
    void qc.invalidateQueries({ queryKey: getGetUserFollowingQueryKey(userId) });
  };
  const followMutation = useFollowBar({ mutation: { onSuccess: refreshFollows } });
  const unfollowMutation = useUnfollowBar({ mutation: { onSuccess: refreshFollows } });
  const followBusy = followMutation.isPending || unfollowMutation.isPending;
  const prefQuery = useGetVenueNotificationPreference(barId, {
    query: { enabled: following, queryKey: getGetVenueNotificationPreferenceQueryKey(barId) },
  });
  const setPref = useSetVenueNotificationPreference();
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const alertsOn = Boolean(prefQuery.data?.enabled);
  const canNotify = notificationsSupported();
  const toggleAlerts = async () => {
    setAlertError(null);
    setAlertBusy(true);
    try {
      if (!alertsOn) await enableDeviceNotifications();
      await setPref.mutateAsync({ barId, data: { enabled: !alertsOn } });
      await qc.invalidateQueries({ queryKey: getGetVenueNotificationPreferenceQueryKey(barId) });
    } catch (e) {
      setAlertError(e instanceof Error && e.message ? e.message : 'Couldn’t update alerts. Try again.');
    } finally {
      setAlertBusy(false);
    }
  };
  const tallyMutation = useTallyDrink({
    mutation: {
      onSuccess: async () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await drinksQuery.refetch();
      },
    },
  });

  if (barQuery.isLoading) {
    return (
      <View style={[styles.loadingPage, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!barQuery.data) {
    return (
      <View style={[styles.loadingPage, { backgroundColor: colors.background, gap: 10 }]}>
        <Feather name="map-pin" size={30} color={colors.mutedForeground} />
        <Text style={[styles.notFound, { color: colors.foreground }]}>Venue not found</Text>
      </View>
    );
  }

  const bar = barQuery.data;

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.muted }]}>
          {bar.coverImageUrl ? (
            <Image source={{ uri: bar.coverImageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroFallback, { backgroundColor: colors.secondary }]}>
              <Text style={styles.heroInitial}>{bar.name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.heroOverlay} />
          <View style={styles.heroCopy}>
            {bar.subscriptionActive && (
              <View style={[styles.proBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.proText}>PRO VENUE</Text>
              </View>
            )}
            <Text style={[styles.barName, { color: colors.foreground }]}>{bar.name}</Text>
            {bar.address && (
              <View style={styles.addressRow}>
                <Feather name="map-pin" size={14} color={colors.accent} />
                <Text style={[styles.address, { color: colors.foreground }]}>{bar.address}</Text>
              </View>
            )}
          </View>
        </View>

        {bar.description && <Text style={[styles.description, { color: colors.mutedForeground }]}>{bar.description}</Text>}

        <View style={styles.favWrap}>
          <Pressable
            accessibilityRole="button"
            disabled={followBusy || followQuery.isLoading}
            onPress={() => {
              if (!user) { void login(); return; }
              if (following) unfollowMutation.mutate({ barId, data: { userId } });
              else followMutation.mutate({ barId, data: { userId } });
            }}
            style={[styles.favButton, { backgroundColor: following ? colors.muted : colors.primary, opacity: followBusy ? 0.7 : 1 }]}
          >
            <Feather name="heart" size={16} color={following ? colors.primary : colors.primaryForeground} />
            <Text style={[styles.favText, { color: following ? colors.foreground : colors.primaryForeground }]}>
              {!user ? 'LOG IN TO SAVE' : following ? 'REMOVE FAVORITE' : 'SAVE FAVORITE'}
            </Text>
          </Pressable>
          {(followMutation.isError || unfollowMutation.isError || followQuery.isError) && (
            <Text style={[styles.alertNote, { color: colors.destructive }]}>Couldn’t update your favorite. Try again.</Text>
          )}
          {following && (
            <View style={[styles.alertBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.specialTitle, { color: colors.foreground }]}>Special alerts</Text>
                <Text style={[styles.alertNote, { color: colors.mutedForeground }]}>
                  {canNotify
                    ? 'Optional. Get a notification when this venue sends an opt-in promotion.'
                    : 'Alerts need the installed Weekender app, not Expo Go or web.'}
                </Text>
              </View>
              {prefQuery.isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Pressable disabled={!canNotify || alertBusy} onPress={() => void toggleAlerts()} style={{ opacity: canNotify ? 1 : 0.4 }}>
                  <Text style={[styles.favText, { color: colors.accent }]}>{alertBusy ? 'WORKING' : alertsOn ? 'TURN OFF' : 'TURN ON'}</Text>
                </Pressable>
              )}
            </View>
          )}
          {following && (alertError || prefQuery.isError) && (
            <Text style={[styles.alertNote, { color: colors.destructive }]}>{alertError ?? 'Couldn’t load your alert setting.'}</Text>
          )}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Tonight’s tally</Text>
          <Text style={[styles.anonymous, { color: colors.accent }]}>ANONYMOUS</Text>
        </View>

        {drinksQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.inlineLoader} />
        ) : (drinksQuery.data ?? []).length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>This venue has not added drinks yet.</Text>
          </View>
        ) : (
          <View style={styles.drinkList}>
            {(drinksQuery.data ?? []).map((drink) => (
              <View key={drink.id} style={[styles.drink, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.drinkIcon, { backgroundColor: colors.primary + '24' }]}>
                  <DrinkIcon name={drink.name} category={drink.category} color={colors.primary} size={22} />
                </View>
                <View style={styles.drinkCopy}>
                  <Text style={[styles.drinkName, { color: colors.foreground }]}>{drink.name}</Text>
                  <Text style={[styles.drinkMeta, { color: colors.mutedForeground }]}>
                    {[drink.category, drink.price].filter(Boolean).join(' · ') || 'On the menu'}
                  </Text>
                </View>
                <View style={styles.tallyWrap}>
                  <Text style={[styles.tallyNumber, { color: colors.primary }]}>{drink.tallyCount}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Tally ${drink.name}`}
                    disabled={tallyMutation.isPending}
                    onPress={() => tallyMutation.mutate({ drinkId: drink.id, data: {} })}
                    style={({ pressed }) => [
                      styles.tallyButton,
                      { backgroundColor: colors.primary, opacity: pressed || tallyMutation.isPending ? 0.75 : 1 },
                    ]}
                  >
                    <Feather name="plus" size={17} color={colors.primaryForeground} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {(specialsQuery.data ?? []).length > 0 && (
          <>
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Posted by the venue</Text>
              <Feather name="star" size={17} color={colors.accent} />
            </View>
            <View style={styles.specialList}>
              {(specialsQuery.data ?? []).map((special) => (
                <View key={special.id} style={[styles.special, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={[styles.specialTitle, { color: colors.foreground }]}>{special.title}</Text>
                  {special.description && <Text style={[styles.specialDetail, { color: colors.mutedForeground }]}>{special.description}</Text>}
                </View>
              ))}
            </View>
          </>
        )}

        <Pressable
          testID="link-spin-specials"
          onPress={() => router.push({ pathname: '/spin', params: { barId: String(barId) } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}
        >
          <Text style={{ fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 1, color: colors.accent }}>SPIN THIS VENUE’S SPECIALS</Text>
          <Feather name="arrow-up-right" size={14} color={colors.accent} />
        </Pressable>

        <PublicSpecials
          specials={publicSpecialsQuery.data}
          isLoading={publicSpecialsQuery.isLoading}
          isError={publicSpecialsQuery.isError}
          onRetry={() => void publicSpecialsQuery.refetch()}
        />

        <View style={[styles.privacy, { borderColor: colors.border }]}>
          <Feather name="shield" size={16} color={colors.accent} />
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            A tally only raises this drink’s number. It never creates a personal drinking record.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingBottom: 42, gap: 18 },
  loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontFamily: 'Outfit_700Bold', fontSize: 18 },
  hero: { height: 260, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  heroInitial: { color: '#FFFFFF', fontFamily: 'Outfit_800ExtraBold', fontSize: 78 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 10, 15, 0.52)' },
  heroCopy: { position: 'absolute', left: 20, right: 20, bottom: 20, gap: 7 },
  proBadge: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  proText: { color: '#FFFFFF', fontFamily: 'SpaceMono_700Bold', fontSize: 9, letterSpacing: 0.8 },
  barName: { fontFamily: 'Outfit_800ExtraBold', fontSize: 34, letterSpacing: -0.8 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  address: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, flex: 1 },
  description: { paddingHorizontal: 20, fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 21 },
  sectionHeading: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 21 },
  anonymous: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, letterSpacing: 0.8 },
  inlineLoader: { marginVertical: 28 },
  drinkList: { paddingHorizontal: 20, gap: 9 },
  drink: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  drinkIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  drinkCopy: { flex: 1, gap: 3 },
  drinkName: { fontFamily: 'Outfit_700Bold', fontSize: 17 },
  drinkMeta: { fontFamily: 'SpaceMono_400Regular', fontSize: 10 },
  tallyWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tallyNumber: { fontFamily: 'SpaceMono_700Bold', fontSize: 15, minWidth: 25, textAlign: 'right' },
  tallyButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  empty: { marginHorizontal: 20, borderWidth: 1, borderRadius: 14, padding: 18 },
  emptyText: { fontFamily: 'Outfit_400Regular', fontSize: 13, textAlign: 'center' },
  specialList: { paddingHorizontal: 20, gap: 8 },
  special: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  specialTitle: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  specialDetail: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
  favWrap: { paddingHorizontal: 20, gap: 8 },
  favButton: { minHeight: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  favText: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 0.8 },
  alertBox: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertNote: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
  privacy: { marginHorizontal: 20, borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  privacyText: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
});