import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Feather } from '@/components/AppIcon';
import { useRouter } from 'expo-router';
import type { DiscoveredVenue } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { formatDistance } from '@/utils/location';

type LiveVenueCardProps = {
  venue: DiscoveredVenue;
};

function mapsUrl(venue: DiscoveredVenue): string {
  if (venue.googleMapsUri) return venue.googleMapsUri;
  const query = encodeURIComponent([venue.name, venue.address].filter(Boolean).join(' '));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function LiveVenueCard({ venue }: LiveVenueCardProps) {
  const colors = useColors();
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`View ${venue.name}`}
      onPress={() => router.push({ pathname: '/places/[providerId]' as '/bars/[barId]', params: { providerId: venue.providerId } as never })}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.accent,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.sourcePill, { backgroundColor: colors.accent + '24' }]}>
          <Feather name="radio" size={12} color={colors.accent} />
          <Text style={[styles.sourceText, { color: colors.accent }]}>LIVE NEARBY</Text>
        </View>
        <Pressable accessibilityRole="link" accessibilityLabel={`Open ${venue.name} in Google Maps`} hitSlop={10} onPress={() => void Linking.openURL(mapsUrl(venue))}>
          <Feather name="external-link" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <Text numberOfLines={2} style={[styles.name, { color: colors.foreground }]}>
        {venue.name}
      </Text>
      {venue.address && (
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={13} color={colors.accent} />
          <Text numberOfLines={2} style={[styles.meta, { color: colors.mutedForeground }]}>
            {venue.address}
          </Text>
        </View>
      )}
      <View style={styles.metaRow}>
        <Feather name="navigation" size={13} color={colors.accent} />
        <Text style={[styles.distance, { color: colors.accent }]}>{formatDistance(venue.distanceMiles)}</Text>
      </View>
      <Text style={[styles.action, { color: colors.mutedForeground }]}>VIEW DETAILS</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 15,
    gap: 9,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  sourceText: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
    letterSpacing: 0.7,
  },
  name: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 19,
    lineHeight: 23,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  meta: {
    flex: 1,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  distance: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
  },
  action: {
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
    letterSpacing: 0.7,
    marginTop: 2,
  },
});