import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Feather } from '@/components/AppIcon';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  COMMON_BAR_DRINKS,
  getCurrentSpecialChoices,
  isSpinChoiceCurrent,
  getGetPublicVenueQueryKey,
  getListBarSpecialsQueryKey,
  getListPublicSpecialsQueryKey,
  useGetPublicVenue,
  useListBarSpecials,
  useListBars,
  useListPublicSpecials,
  type SpinDrinkChoice,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

type SpinMode = 'drinks' | 'bars';
type DrinkSource = 'specials' | 'random';
type Entry = { id: string; title: string; subtitle: string; barId?: number; choice?: SpinDrinkChoice };

const safeHaptic = (fn: () => Promise<unknown>) => {
  try {
    void fn().catch(() => undefined);
  } catch {
    // haptics are optional
  }
};
const fmt = (iso?: string) => {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T00:00:00`).toLocaleDateString();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

export default function SpinScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ barId?: string; providerId?: string }>();
  const barsQuery = useListBars();
  const [mode, setMode] = useState<SpinMode>('drinks');
  const ctxBar = Number(params.barId);
  const initialSel = Number.isInteger(ctxBar) && ctxBar > 0 ? `bar:${ctxBar}` : params.providerId ? `place:${params.providerId}` : '';
  const [source, setSource] = useState<DrinkSource>(initialSel ? 'specials' : 'random');
  const [sel, setSel] = useState(initialSel);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Entry | null>(null);
  const [now, setNow] = useState(Date.now);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelSpin = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    setSpinning(false);
  }, []);

  useEffect(() => cancelSpin, [cancelSpin]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (initialSel) {
      setSel(initialSel);
      setSource('specials');
      setMode('drinks');
    }
  }, [initialSel]);

  const barId = sel.startsWith('bar:') ? Number(sel.slice(4)) : undefined;
  const providerId = sel.startsWith('place:') ? sel.slice(6) : undefined;
  const contextProviderId = params.providerId || providerId;
  const venueQuery = useGetPublicVenue(contextProviderId ?? '', {
    query: { enabled: !!contextProviderId, queryKey: getGetPublicVenueQueryKey(contextProviderId ?? '') },
  });
  const ownerQuery = useListBarSpecials(barId ?? 0, {
    query: { enabled: mode === 'drinks' && source === 'specials' && barId !== undefined, refetchInterval: 30_000, queryKey: getListBarSpecialsQueryKey(barId ?? 0) },
  });
  const pubParams = barId !== undefined ? { barId } : { providerId: providerId ?? '' };
  const publicQuery = useListPublicSpecials(pubParams, {
    query: { enabled: mode === 'drinks' && source === 'specials' && sel !== '', refetchInterval: 30_000, queryKey: getListPublicSpecialsQueryKey(pubParams) },
  });
  const bar = barId !== undefined ? barsQuery.data?.find((b) => b.id === barId) : undefined;
  const venueName = barId !== undefined ? bar?.name : venueQuery.data?.name;
  const venueAddress = barId !== undefined ? bar?.address : venueQuery.data?.address;

  const specialChoices = useMemo(
    () => (sel ? getCurrentSpecialChoices(ownerQuery.data ?? [], publicQuery.data ?? [], now) : []),
    [sel, ownerQuery.data, publicQuery.data, now],
  );

  const specialsMode = mode === 'drinks' && source === 'specials';
  const specialsLoading = specialsMode && sel !== '' && ((barId !== undefined && (ownerQuery.isLoading || barsQuery.isLoading)) || (providerId !== undefined && venueQuery.isLoading) || publicQuery.isLoading);
  const specialsError = specialsMode && sel !== '' && ((barId !== undefined && (ownerQuery.isError || barsQuery.isError)) || (providerId !== undefined && venueQuery.isError) || publicQuery.isError);

  const entries: Entry[] = useMemo(() => {
    if (mode === 'bars') {
      return (barsQuery.data ?? []).map((b) => ({ id: `bar-${b.id}`, title: b.name, subtitle: b.address ?? 'A local favorite', barId: b.id }));
    }
    const pool = source === 'random' ? COMMON_BAR_DRINKS : specialChoices;
    return pool.map((c: SpinDrinkChoice) => ({
      id: c.id,
      title: c.name,
      subtitle: c.description,
      barId: source === 'specials' ? barId : undefined,
      choice: c,
    }));
  }, [mode, source, barsQuery.data, specialChoices, barId]);

  // Pool identity: any change cancels spin and clears the result.
  const poolKey = `${mode}|${source}|${sel}|${entries.map((e) => e.id).join(',')}`;
  useEffect(() => {
    cancelSpin();
    setResult(null);
  }, [poolKey, cancelSpin]);

  const spin = () => {
    if (spinning || entries.length === 0) return;
    cancelSpin();
    const pool = entries;
    setSpinning(true);
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    let index = Math.floor(Math.random() * pool.length);
    setResult(pool[index]);
    intervalRef.current = setInterval(() => {
      index = (index + 1) % pool.length;
      setResult(pool[index]);
      safeHaptic(() => Haptics.selectionAsync());
    }, 95);
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      timeoutRef.current = null;
      const current = pool.filter((entry) => !entry.choice || isSpinChoiceCurrent(entry.choice));
      setResult(current.length ? current[Math.floor(Math.random() * current.length)] : null);
      setNow(Date.now());
      setSpinning(false);
      safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    }, 1500);
  };

  const loading = mode === 'bars' ? barsQuery.isLoading : specialsLoading;
  const retry = () => {
    if (barId !== undefined) void barsQuery.refetch();
    if (providerId) void venueQuery.refetch();
    if (barId !== undefined) void ownerQuery.refetch();
    void publicQuery.refetch();
  };
  const noun = mode === 'bars' ? 'BAR' : source === 'random' ? 'DRINK' : 'SPECIAL';
  const checked = !!result?.choice?.sourceUrl && source === 'specials';

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
              disabled={spinning}
              onPress={() => {
                cancelSpin();
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

        {mode === 'drinks' && (
          <View style={styles.sourceBlock}>
            <View style={[styles.switcher, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              {([['specials', 'BAR SPECIALS'], ['random', 'RANDOM DRINK']] as [DrinkSource, string][]).map(([id, label]) => (
                <Pressable
                  key={id}
                  testID={`tab-drink-${id}`}
                  disabled={spinning}
                  onPress={() => setSource(id)}
                  style={[styles.switchOption, source === id && { backgroundColor: colors.primary }, spinning && { opacity: 0.5 }]}
                >
                  <Text style={[styles.switchLabel, { color: source === id ? colors.primaryForeground : colors.mutedForeground }]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {source === 'random' ? (
              <Text style={[styles.sourceNote, { color: colors.mutedForeground }]}>
                20 common bar drinks. A general idea only: no venue needed, nothing saved, and no guarantee any bar serves it.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {contextProviderId && (
                    <Pressable
                      disabled={spinning}
                      onPress={() => setSel(`place:${contextProviderId}`)}
                      style={[styles.chip, { borderColor: sel === `place:${contextProviderId}` ? colors.primary : colors.border, backgroundColor: colors.card }]}
                    >
                      <Text numberOfLines={1} style={[styles.chipTitle, { color: colors.foreground }]}>{venueQuery.data?.name ?? 'Google Maps place'}</Text>
                      <Text numberOfLines={1} style={[styles.chipSub, { color: colors.mutedForeground }]}>Checked specials only</Text>
                    </Pressable>
                  )}
                  {(barsQuery.data ?? []).map((b) => (
                    <Pressable
                      key={b.id}
                      disabled={spinning}
                      onPress={() => setSel(`bar:${b.id}`)}
                      style={[styles.chip, { borderColor: sel === `bar:${b.id}` ? colors.primary : colors.border, backgroundColor: colors.card, opacity: spinning ? 0.5 : 1 }]}
                    >
                      <Text numberOfLines={1} style={[styles.chipTitle, { color: colors.foreground }]}>{b.name}</Text>
                      <Text numberOfLines={1} style={[styles.chipSub, { color: colors.mutedForeground }]}>{b.address ?? 'Address not listed'}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {barsQuery.isError && (
                  <Pressable onPress={() => void barsQuery.refetch()}>
                    <Text style={[styles.sourceNote, { color: colors.destructive }]}>Could not load venues. Tap to retry.</Text>
                  </Pressable>
                )}
                {sel === '' ? (
                  <Text style={[styles.sourceNote, { color: colors.mutedForeground }]}>Pick the exact venue to see its current specials.</Text>
                ) : (
                  <View style={[styles.note, { borderColor: colors.border }]}>
                    <Feather name="map-pin" size={15} color={colors.accent} />
                    <Text style={[styles.noteText, { color: colors.foreground }]}>
                      {venueName ?? 'Loading venue'}{venueAddress ? `\n${venueAddress}` : ''}
                      {providerId ? '\nGoogle Maps place: checked public specials only.' : ''}
                    </Text>
                  </View>
                )}
                {specialsError && (
                  <Pressable onPress={retry} style={[styles.venueLink, { borderColor: colors.border }]}>
                    <Text style={[styles.venueLinkText, { color: colors.destructive }]}>COULD NOT LOAD SPECIALS. RETRY</Text>
                  </Pressable>
                )}
                {sel !== '' && !specialsLoading && !specialsError && entries.length === 0 && (
                  <Text style={[styles.sourceNote, { color: colors.mutedForeground }]}>
                    No current specials found for this venue. Try Random drink for a general idea instead.
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

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
                  {spinning ? 'SPINNING' : mode === 'bars' ? 'THE NIGHT GOES TO' : source === 'random' ? 'RANDOM SUGGESTION' : checked ? 'CHECKED SPECIAL' : 'VENUE SPECIAL'}
                </Text>
                <Text numberOfLines={2} style={[styles.resultTitle, { color: colors.foreground }]}>{result.title}</Text>
                <Text numberOfLines={2} style={[styles.resultSubtitle, { color: colors.mutedForeground }]}>{result.subtitle}</Text>
              </>
            ) : (
              <>
                <Feather name="compass" size={48} color={colors.accent} />
                <Text style={[styles.readyTitle, { color: colors.foreground }]}>Ready when you are.</Text>
                <Text style={[styles.readyCopy, { color: colors.mutedForeground }]}>Fate picks from the source you chose.</Text>
              </>
            )}
          </View>
        </LinearGradient>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Spin for a ${noun.toLowerCase()}`}
          disabled={loading || spinning || specialsError || entries.length === 0}
          onPress={spin}
          style={({ pressed }) => [
            styles.spinButton,
            { backgroundColor: colors.primary, opacity: pressed || loading || entries.length === 0 ? 0.76 : 1 },
          ]}
        >
          <Feather name={spinning ? 'loader' : 'rotate-cw'} size={20} color={colors.primaryForeground} />
          <Text style={[styles.spinText, { color: colors.primaryForeground }]}>
            {spinning ? 'SPINNING' : `SPIN FOR A ${noun}`}
          </Text>
        </Pressable>

        {!spinning && result?.choice && source === 'specials' && mode === 'drinks' && checked && (
          <View style={[styles.note, { borderColor: colors.border, flexDirection: 'column', alignItems: 'flex-start' }]}>
            {result.choice.checkedAt && <Text style={[styles.noteText, { color: colors.mutedForeground }]}>Checked {fmt(result.choice.checkedAt)}</Text>}
            {result.choice.expiresAt && <Text style={[styles.noteText, { color: colors.mutedForeground }]}>Expires {fmt(result.choice.expiresAt)}</Text>}
            <Pressable onPress={() => void Linking.openURL(result.choice!.sourceUrl!)} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Text style={[styles.venueLinkText, { color: colors.accent }]}>VIEW SOURCE</Text>
              <Feather name="external-link" size={14} color={colors.accent} />
            </Pressable>
          </View>
        )}

        {!spinning && mode === 'drinks' && source === 'random' && result && (
          <Text style={[styles.sourceNote, { color: colors.mutedForeground }]}>
            Random suggestion. Not a claim of what any bar stocks, and not a popularity ranking.
          </Text>
        )}

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
  sourceBlock: { gap: 12 },
  sourceNote: { fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 18 },
  chip: { width: 190, borderWidth: 1.5, borderRadius: 14, padding: 12, gap: 2 },
  chipTitle: { fontFamily: 'Outfit_700Bold', fontSize: 14 },
  chipSub: { fontFamily: 'Outfit_400Regular', fontSize: 12 },
  note: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  noteText: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
});