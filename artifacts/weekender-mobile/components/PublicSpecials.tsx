import React from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Feather } from '@/components/AppIcon';
import type { PublicSpecial } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

type Props = {
  specials: PublicSpecial[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
};

export function PublicSpecials({ specials, isLoading, isError, onRetry }: Props) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.foreground }]}>Sourced specials</Text>
        <Text style={[styles.tag, { color: colors.accent }]}>PUBLIC INFO</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : isError ? (
        <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.body, { color: colors.destructive }]}>Couldn’t load sourced specials.</Text>
          <Pressable onPress={onRetry}><Text style={[styles.link, { color: colors.accent }]}>TRY AGAIN</Text></Pressable>
        </View>
      ) : (specials ?? []).length === 0 ? (
        <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>No current sourced specials. Hours and prices change, so check with the venue.</Text>
        </View>
      ) : (
        (specials ?? []).map((s) => (
          <View key={s.id} style={[styles.box, { borderColor: colors.border, backgroundColor: colors.muted }]}>
            <Text style={[styles.sTitle, { color: colors.foreground }]}>{s.title}</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>{s.description}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>Checked {fmt(s.checkedAt)} · Expires {fmt(s.expiresAt)}</Text>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(s.sourceUrl)} style={styles.srcRow}>
              <Feather name="external-link" size={13} color={colors.accent} />
              <Text numberOfLines={1} style={[styles.link, { color: colors.accent, flex: 1 }]}>SOURCE: {s.sourceUrl}</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 21 },
  tag: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, letterSpacing: 0.8 },
  box: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 },
  sTitle: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  body: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
  meta: { fontFamily: 'SpaceMono_400Regular', fontSize: 10 },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  link: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, letterSpacing: 0.4 },
});
