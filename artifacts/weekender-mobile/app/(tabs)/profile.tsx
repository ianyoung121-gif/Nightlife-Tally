import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useGetTrendingStats } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useDeviceLocation } from '@/context/LocationContext';

export default function ProfileScreen() {
  const colors = useColors();
  const statsQuery = useGetTrendingStats();
  const location = useDeviceLocation();

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>YOUR NIGHT OUT</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Keep it your way.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            The Weekender keeps your tallies anonymous and your plans on your device.
          </Text>
        </View>

        <View style={[styles.communityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.communityIcon, { backgroundColor: colors.primary }]}>
            <Feather name="activity" size={22} color={colors.primaryForeground} />
          </View>
          <View style={styles.communityCopy}>
            <Text style={[styles.communityNumber, { color: colors.foreground }]}>
              {statsQuery.data?.totalTallies ?? '—'}
            </Text>
            <Text style={[styles.communityLabel, { color: colors.mutedForeground }]}>ANONYMOUS TALLIES IN THE COMMUNITY</Text>
          </View>
        </View>

        <View style={styles.settingList}>
          <View style={[styles.setting, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent + '26' }]}>
              <Feather name="map-pin" size={18} color={colors.accent} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Location</Text>
              <Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>
                {location.status === 'ready' ? 'Active for nearby venues and plans.' : 'Off until you choose to enable it.'}
              </Text>
            </View>
            {location.status !== 'ready' && (
              <Pressable onPress={location.requestLocation}>
                <Text style={[styles.enable, { color: colors.accent }]}>ENABLE</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.setting, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.secondary + '26' }]}>
              <Feather name="shield" size={18} color={colors.secondary} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Anonymous tallying</Text>
              <Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>
                Drinks add to the vibe — not to a personal history.
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.safety, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <Feather name="heart" size={18} color={colors.primary} />
          <View style={styles.safetyCopy}>
            <Text style={[styles.safetyTitle, { color: colors.foreground }]}>Get home safe.</Text>
            <Text style={[styles.safetyText, { color: colors.mutedForeground }]}>
              Plan your ride before your first stop. Never drink and drive.
            </Text>
          </View>
        </View>
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
  communityCard: { borderWidth: 1, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  communityIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  communityCopy: { flex: 1, gap: 2 },
  communityNumber: { fontFamily: 'Outfit_800ExtraBold', fontSize: 28 },
  communityLabel: { fontFamily: 'SpaceMono_700Bold', fontSize: 9, letterSpacing: 0.8 },
  settingList: { gap: 10 },
  setting: { borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  settingDetail: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
  enable: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, letterSpacing: 0.6 },
  safety: { borderWidth: 1, borderRadius: 15, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  safetyCopy: { flex: 1, gap: 3 },
  safetyTitle: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  safetyText: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17 },
});