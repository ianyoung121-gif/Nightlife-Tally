import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Feather } from '@/components/AppIcon';
import type { Bar } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { formatDistance } from '@/utils/location';

type VenueCardProps = {
  bar: Bar;
  distance?: number | null;
  onPress: () => void;
  compact?: boolean;
};

export function VenueCard({ bar, distance = null, onPress, compact = false }: VenueCardProps) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${bar.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      {!compact && (
        <View style={[styles.imageWrap, { backgroundColor: colors.muted }]}>
          {bar.coverImageUrl ? (
            <Image source={{ uri: bar.coverImageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.monogram, { backgroundColor: colors.secondary }]}>
              <Text style={styles.monogramText}>{bar.name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          {bar.subscriptionActive && (
            <View style={[styles.proBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.proText}>PRO</Text>
            </View>
          )}
        </View>
      )}

      <View style={[styles.content, compact && styles.compactContent]}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
            {bar.name}
          </Text>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>

        {bar.address && (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={13} color={colors.accent} />
            <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground }]}>
              {bar.address}
            </Text>
          </View>
        )}

        {distance !== null && (
          <View style={styles.metaRow}>
            <Feather name="navigation" size={13} color={colors.accent} />
            <Text style={[styles.distance, { color: colors.accent }]}>{formatDistance(distance)}</Text>
          </View>
        )}

        {!compact && (
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={styles.footerMetric}>
              <Feather name="users" size={14} color={colors.secondary} />
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{bar.followerCount}</Text>
            </View>
            <View style={styles.footerMetric}>
              <Feather name="activity" size={14} color={colors.primary} />
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{bar.totalTallies}</Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageWrap: {
    height: 122,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  monogram: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 46,
  },
  proBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  proText: {
    color: '#FFFFFF',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  content: {
    padding: 14,
    gap: 7,
  },
  compactContent: {
    paddingVertical: 15,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    flex: 1,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
  },
  distance: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
  },
  footer: {
    borderTopWidth: 1,
    marginTop: 5,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
  },
});