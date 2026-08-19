import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import type { Bar } from '@workspace/api-client-react';
import { useListBars } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useDeviceLocation } from '@/context/LocationContext';
import { distanceMiles, formatDistance, hasVerifiedVenueLocation } from '@/utils/location';

const dinnerIdeas = [
  { title: 'Candlelit Italian', detail: 'Pasta, wine, slow conversation.' },
  { title: 'Rooftop Sushi', detail: 'City lights and a shared plate.' },
  { title: 'Tapas & Wine', detail: 'Small plates and no rush.' },
  { title: 'Hidden Gem Ramen', detail: 'Cozy, casual, and memorable.' },
  { title: 'Tasting Menu', detail: 'Make it a night worth dressing up for.' },
];

const dateDares = [
  'Order something for each other without looking at the menu.',
  'Put phones away for the next thirty minutes.',
  'Share a first-date story neither of you has told before.',
  'Pick a song you both know before the night ends.',
  'Write one thing you appreciate about the other on a napkin.',
];

type PlanItem = {
  slot: string;
  time: string;
  icon: keyof typeof Feather.glyphMap;
  accent: 'primary' | 'secondary' | 'accent';
  bar?: Bar;
  detail: string;
  dare?: string;
};

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
  }
  return copy;
}

export default function DateNightScreen() {
  const colors = useColors();
  const router = useRouter();
  const barsQuery = useListBars();
  const location = useDeviceLocation();
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [planning, setPlanning] = useState(false);
  const verifiedBars = useMemo(
    () => (barsQuery.data ?? []).filter(hasVerifiedVenueLocation),
    [barsQuery.data],
  );

  const nearbyBars = useMemo(() => {
    if (!barsQuery.data) return [];
    const enriched = barsQuery.data.map((bar) => ({
      bar,
      distance:
        location.coordinates && hasVerifiedVenueLocation(bar)
          ? distanceMiles(location.coordinates, { latitude: bar.latitude, longitude: bar.longitude })
          : null,
    }));
    return enriched.sort((first, second) => (first.distance ?? Infinity) - (second.distance ?? Infinity));
  }, [barsQuery.data, location.coordinates]);

  const createPlan = () => {
    if (planning) return;
    setPlanning(true);
    setTimeout(() => {
      const localPool = nearbyBars.filter((item) => item.distance !== null).map((item) => item.bar);
      const source = localPool.length > 0 ? localPool : verifiedBars;
      const picks = shuffled(source).slice(0, 3);
      const dinner = dinnerIdeas[Math.floor(Math.random() * dinnerIdeas.length)];
      const dares = shuffled(dateDares);

      setPlan([
        {
          slot: 'Pre-dinner cocktails',
          time: '7:00 PM',
          icon: 'coffee',
          accent: 'primary',
          bar: picks[0],
          detail: picks[0] ? 'Set the mood with a first-round favorite.' : 'Pick a relaxed nearby bar to begin.',
          dare: dares[0],
        },
        {
          slot: 'Dinner vibes',
          time: '8:30 PM',
          icon: 'star',
          accent: 'secondary',
          detail: `${dinner.title} — ${dinner.detail}`,
        },
        {
          slot: 'Nightcap lounge',
          time: '10:30 PM',
          icon: 'moon',
          accent: 'accent',
          bar: picks[1],
          detail: picks[1] ? 'A softer landing for the best part of the conversation.' : 'Find a cozy place for one last great drink.',
          dare: dares[1],
        },
        {
          slot: 'Late-night wildcard',
          time: 'If it feels right',
          icon: 'zap',
          accent: 'primary',
          bar: picks[2],
          detail: picks[2] ? 'One optional stop to make the night last.' : 'Save this one for a spontaneous detour.',
          dare: dares[2],
        },
      ]);
      setPlanning(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 900);
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>FOR TWO</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Date night, mapped.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Drinks, dinner, a nightcap, and room for a little fate.
          </Text>
        </View>

        <View style={[styles.locationHint, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="navigation" size={17} color={colors.accent} />
          <Text style={[styles.locationHintText, { color: colors.mutedForeground }]}>
            {verifiedBars.length === 0
              ? 'Date plans unlock once venue owners verify their pins.'
              : location.status === 'ready'
              ? 'Nearby venues will be preferred in your plan.'
              : 'Add location to prioritize bars around you.'}
          </Text>
          {location.status !== 'ready' && (
            <Pressable onPress={location.requestLocation}>
              <Text style={[styles.locationLink, { color: colors.accent }]}>ENABLE</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Plan date night"
          disabled={planning || barsQuery.isLoading || verifiedBars.length === 0}
          onPress={createPlan}
          style={({ pressed }) => [
            styles.planButton,
            { backgroundColor: colors.primary, opacity: pressed || planning ? 0.78 : 1 },
          ]}
        >
          {planning ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="heart" size={20} color={colors.primaryForeground} />}
          <Text style={[styles.planButtonText, { color: colors.primaryForeground }]}>
            {planning ? 'BUILDING YOUR NIGHT' : verifiedBars.length === 0 ? 'VENUE PINS NEEDED' : plan ? 'REPLAN THE NIGHT' : 'PLAN DATE NIGHT'}
          </Text>
        </Pressable>

        {plan ? (
          <View style={styles.timeline}>
            {plan.map((item, index) => {
              const accentColor = colors[item.accent];
              const distance =
                item.bar && location.coordinates && hasVerifiedVenueLocation(item.bar)
                  ? distanceMiles(location.coordinates, { latitude: item.bar.latitude, longitude: item.bar.longitude })
                  : null;
              return (
                <View key={item.slot} style={styles.timelineItem}>
                  <View style={styles.lineColumn}>
                    <View style={[styles.timelineIcon, { backgroundColor: accentColor }]}>
                      <Feather name={item.icon} size={17} color={colors.background} />
                    </View>
                    {index < plan.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                  </View>
                  <Pressable
                    disabled={!item.bar}
                    onPress={() => item.bar && router.push({ pathname: '/bars/[barId]', params: { barId: String(item.bar.id) } })}
                    style={[
                      styles.planCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      !item.bar && styles.staticCard,
                    ]}
                  >
                    <Text style={[styles.slot, { color: accentColor }]}>{item.slot.toUpperCase()} · {item.time}</Text>
                    <Text style={[styles.planTitle, { color: colors.foreground }]}>
                      {item.bar?.name ?? item.detail.split(' — ')[0]}
                    </Text>
                    {item.bar?.address && (
                      <Text style={[styles.address, { color: colors.mutedForeground }]}>{item.bar.address}</Text>
                    )}
                    {distance !== null && (
                      <Text style={[styles.distance, { color: colors.accent }]}>{formatDistance(distance)}</Text>
                    )}
                    <Text style={[styles.planDetail, { color: colors.mutedForeground }]}>{item.bar ? item.detail : item.detail.split(' — ').slice(1).join(' — ') || item.detail}</Text>
                    {item.dare && (
                      <View style={[styles.dare, { backgroundColor: colors.muted }]}>
                        <Text style={[styles.dareLabel, { color: colors.primary }]}>DATE DARE</Text>
                        <Text style={[styles.dareText, { color: colors.mutedForeground }]}>{item.dare}</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyPlan, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="heart" size={32} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Make the first move.</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Your plan will pull in local Weekender venues when they’re available.
            </Text>
          </View>
        )}
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
  locationHint: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'center' },
  locationHintText: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
  locationLink: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, letterSpacing: 0.5 },
  planButton: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  planButtonText: { fontFamily: 'SpaceMono_700Bold', fontSize: 12, letterSpacing: 0.8 },
  timeline: { gap: 4, marginTop: 4 },
  timelineItem: { flexDirection: 'row', minHeight: 126 },
  lineColumn: { width: 39, alignItems: 'center' },
  timelineIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { flex: 1, width: 1, marginVertical: 6 },
  planCard: { flex: 1, borderWidth: 1, borderRadius: 15, padding: 14, marginBottom: 16, gap: 5 },
  staticCard: { opacity: 0.96 },
  slot: { fontFamily: 'SpaceMono_700Bold', fontSize: 9, letterSpacing: 0.7 },
  planTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18 },
  address: { fontFamily: 'SpaceMono_400Regular', fontSize: 10 },
  distance: { fontFamily: 'SpaceMono_700Bold', fontSize: 10 },
  planDetail: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
  dare: { borderRadius: 10, padding: 10, marginTop: 5, gap: 4 },
  dareLabel: { fontFamily: 'SpaceMono_700Bold', fontSize: 9, letterSpacing: 0.8 },
  dareText: { fontFamily: 'Outfit_400Regular', fontSize: 11, lineHeight: 15 },
  emptyPlan: { minHeight: 196, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 26, gap: 9 },
  emptyTitle: { fontFamily: 'Outfit_700Bold', fontSize: 19 },
  emptyText: { fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 18, textAlign: 'center' },
});