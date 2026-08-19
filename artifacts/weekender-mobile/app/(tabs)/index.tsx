import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGetTrendingStats } from '@workspace/api-client-react';
import { VenueCard } from '@/components/VenueCard';
import { useColors } from '@/hooks/useColors';

export default function DiscoverScreen() {
  const colors = useColors();
  const router = useRouter();
  const statsQuery = useGetTrendingStats();
  const stats = statsQuery.data;

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={statsQuery.isRefetching}
            onRefresh={() => void statsQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
              <Feather name="coffee" size={17} color={colors.primaryForeground} />
            </View>
            <Text style={[styles.brand, { color: colors.foreground }]}>THE WEEKENDER</Text>
          </View>
          <Text style={[styles.headline, { color: colors.foreground }]}>Find tonight’s pulse.</Text>
          <Text style={[styles.subheadline, { color: colors.mutedForeground }]}>
            Live crowd favorites, local spots, zero pressure.
          </Text>
        </View>

        <View style={[styles.pulseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.pulseIcon, { backgroundColor: colors.primary + '24' }]}>
            <Feather name="activity" size={20} color={colors.primary} />
          </View>
          <View style={styles.pulseCopy}>
            <Text style={[styles.pulseValue, { color: colors.foreground }]}>
              {statsQuery.isLoading ? '—' : stats?.totalTallies ?? 0}
            </Text>
            <Text style={[styles.pulseLabel, { color: colors.mutedForeground }]}>LIVE COMMUNITY TALLIES</Text>
          </View>
          <Text style={[styles.pulseCount, { color: colors.accent }]}>{stats?.totalBars ?? 0} BARS</Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Trending now</Text>
          <Feather name="trending-up" size={18} color={colors.primary} />
        </View>

        {statsQuery.isLoading ? (
          <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : statsQuery.isError ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="wifi-off" size={28} color={colors.destructive} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn’t reach the pulse</Text>
            <Pressable onPress={() => void statsQuery.refetch()}>
              <Text style={[styles.retry, { color: colors.accent }]}>TRY AGAIN</Text>
            </Pressable>
          </View>
        ) : (stats?.topBars ?? []).length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="map-pin" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your city is next</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Add the first local venue from the web dashboard.</Text>
          </View>
        ) : (
          <View style={styles.venueList}>
            {(stats?.topBars ?? []).slice(0, 3).map((bar) => (
              <VenueCard
                key={bar.id}
                bar={bar}
                onPress={() => router.push({ pathname: '/bars/[barId]', params: { barId: String(bar.id) } })}
              />
            ))}
          </View>
        )}

        {(stats?.topDrinks ?? []).length > 0 && (
          <>
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What’s being ordered</Text>
              <Feather name="zap" size={18} color={colors.accent} />
            </View>
            <View style={styles.drinkList}>
              {(stats?.topDrinks ?? []).slice(0, 4).map((drink, index) => (
                <View key={drink.id} style={[styles.drinkRow, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.rank, { color: colors.secondary }]}>0{index + 1}</Text>
                  <View style={styles.drinkCopy}>
                    <Text style={[styles.drinkName, { color: colors.foreground }]}>{drink.name}</Text>
                    <Text style={[styles.drinkBar, { color: colors.mutedForeground }]}>{drink.barName ?? 'Local favorite'}</Text>
                  </View>
                  <Text style={[styles.drinkTally, { color: colors.primary }]}>{drink.tallyCount}</Text>
                </View>
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
  header: { marginTop: 6, gap: 7 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: 'Outfit_800ExtraBold', fontSize: 14, letterSpacing: 0.4 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 35, letterSpacing: -1.1, marginTop: 5 },
  subheadline: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22 },
  pulseCard: { borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pulseIcon: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pulseCopy: { flex: 1, gap: 1 },
  pulseValue: { fontFamily: 'Outfit_800ExtraBold', fontSize: 25 },
  pulseLabel: { fontFamily: 'SpaceMono_700Bold', fontSize: 9, letterSpacing: 0.6 },
  pulseCount: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, letterSpacing: 0.6 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 21 },
  loading: { paddingVertical: 62, alignItems: 'center' },
  venueList: { gap: 12 },
  empty: { minHeight: 170, borderWidth: 1, borderRadius: 16, padding: 22, alignItems: 'center', justifyContent: 'center', gap: 9 },
  emptyTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18 },
  emptyText: { fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  retry: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 0.8, marginTop: 4 },
  drinkList: { gap: 8 },
  drinkRow: { minHeight: 61, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { fontFamily: 'SpaceMono_700Bold', fontSize: 11 },
  drinkCopy: { flex: 1, gap: 2 },
  drinkName: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  drinkBar: { fontFamily: 'SpaceMono_400Regular', fontSize: 10 },
  drinkTally: { fontFamily: 'SpaceMono_700Bold', fontSize: 14 },
});
