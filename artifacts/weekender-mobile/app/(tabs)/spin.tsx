import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Feather } from '@/components/AppIcon';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useGetTrendingDrinks, useListBars } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

type SpinMode = 'drinks' | 'bars';
type SpinResult = { title: string; subtitle: string; barId?: number };

export default function SpinScreen() {
  const colors = useColors();
  const router = useRouter();
  const drinksQuery = useGetTrendingDrinks();
  const barsQuery = useListBars();
  const [mode, setMode] = useState<SpinMode>('drinks');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const entries: SpinResult[] =
    mode === 'drinks'
      ? (drinksQuery.data ?? []).map((drink) => ({
          title: drink.name,
          subtitle: drink.barName ? `at ${drink.barName}` : 'Trending tonight',
          barId: drink.barId,
        }))
      : (barsQuery.data ?? []).map((bar) => ({
          title: bar.name,
          subtitle: bar.address ?? 'A local favorite',
          barId: bar.id,
        }));

  const spin = () => {
    if (spinning || entries.length === 0) return;
    setSpinning(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let index = Math.floor(Math.random() * entries.length);
    setResult(entries[index]);

    intervalRef.current = setInterval(() => {
      index = (index + 1) % entries.length;
      setResult(entries[index]);
      void Haptics.selectionAsync();
    }, 95);

    setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const finalResult = entries[Math.floor(Math.random() * entries.length)];
      setResult(finalResult);
      setSpinning(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1500);
  };

  const loading = drinksQuery.isLoading || barsQuery.isLoading;

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>LEAVE IT TO FATE</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Spin the night.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            One tap and the decision is made.
          </Text>
        </View>

        <View style={[styles.switcher, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          {(['drinks', 'bars'] as SpinMode[]).map((choice) => (
            <Pressable
              key={choice}
              onPress={() => {
                setMode(choice);
                setResult(null);
              }}
              style={[
                styles.switchOption,
                mode === choice && { backgroundColor: colors.primary },
              ]}
            >
              <Feather name={choice === 'drinks' ? 'coffee' : 'map-pin'} size={16} color={mode === choice ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.switchLabel, { color: mode === choice ? colors.primaryForeground : colors.mutedForeground }]}>
                {choice === 'drinks' ? 'DRINK' : 'BAR'}
              </Text>
            </Pressable>
          ))}
        </View>

        <LinearGradient
          colors={[colors.secondary, colors.primary]}
          style={styles.orbit}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={[styles.orbitInner, { backgroundColor: colors.background }]}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.accent} />
            ) : result ? (
              <>
                <Text style={[styles.resultEyebrow, { color: colors.accent }]}>
                  {spinning ? 'SPINNING' : mode === 'drinks' ? 'YOU’RE DRINKING' : 'THE NIGHT GOES TO'}
                </Text>
                <Text numberOfLines={2} style={[styles.resultTitle, { color: colors.foreground }]}>{result.title}</Text>
                <Text numberOfLines={2} style={[styles.resultSubtitle, { color: colors.mutedForeground }]}>{result.subtitle}</Text>
              </>
            ) : (
              <>
                <Feather name="compass" size={48} color={colors.accent} />
                <Text style={[styles.readyTitle, { color: colors.foreground }]}>Ready when you are.</Text>
                <Text style={[styles.readyCopy, { color: colors.mutedForeground }]}>Fate will pick from live Weekender picks.</Text>
              </>
            )}
          </View>
        </LinearGradient>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Spin for a ${mode === 'drinks' ? 'drink' : 'bar'}`}
          disabled={loading || spinning || entries.length === 0}
          onPress={spin}
          style={({ pressed }) => [
            styles.spinButton,
            { backgroundColor: colors.primary, opacity: pressed || loading || entries.length === 0 ? 0.76 : 1 },
          ]}
        >
          <Feather name={spinning ? 'loader' : 'rotate-cw'} size={20} color={colors.primaryForeground} />
          <Text style={[styles.spinText, { color: colors.primaryForeground }]}>
            {spinning ? 'SPINNING' : `SPIN FOR A ${mode === 'drinks' ? 'DRINK' : 'BAR'}`}
          </Text>
        </Pressable>

        {result?.barId && !spinning && (
          <Pressable
            onPress={() => router.push({ pathname: '/bars/[barId]', params: { barId: String(result.barId) } })}
            style={[styles.venueLink, { borderColor: colors.border }]}
          >
            <Text style={[styles.venueLinkText, { color: colors.accent }]}>OPEN VENUE</Text>
            <Feather name="arrow-up-right" size={16} color={colors.accent} />
          </Pressable>
        )}

        <View style={[styles.note, { borderColor: colors.border }]}>
          <Feather name="shield" size={15} color={colors.accent} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            Tallying is anonymous. Plan a ride before the night begins.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 20, paddingBottom: 112, gap: 20 },
  header: { marginTop: 6, gap: 7 },
  eyebrow: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 1.6 },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 34, letterSpacing: -1 },
  subtitle: { fontFamily: 'Outfit_400Regular', fontSize: 15 },
  switcher: { borderWidth: 1, borderRadius: 14, padding: 4, flexDirection: 'row' },
  switchOption: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  switchLabel: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 0.7 },
  orbit: { width: '100%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', padding: 8 },
  orbitInner: { width: '100%', height: '100%', borderRadius: 999, alignItems: 'center', justifyContent: 'center', padding: 44, gap: 10 },
  resultEyebrow: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, letterSpacing: 1.4, textAlign: 'center' },
  resultTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 31, textAlign: 'center', lineHeight: 35 },
  resultSubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  readyTitle: { fontFamily: 'Outfit_700Bold', fontSize: 22, textAlign: 'center' },
  readyCopy: { fontFamily: 'Outfit_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  spinButton: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  spinText: { fontFamily: 'SpaceMono_700Bold', fontSize: 13, letterSpacing: 1 },
  venueLink: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  venueLinkText: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, letterSpacing: 1 },
  note: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  noteText: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
});