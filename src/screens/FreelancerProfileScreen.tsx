import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { supabase } from '../services/supabase';
import { colors, typography, spacing, borderRadius } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FreelancerProfile'>;

interface ProfileData {
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  hourly_rate: number | null;
  availability: string;
  service_categories: string[];
  verification_status: string;
  portfolio_items: { id: string; media_url: string; media_type: string; title: string | null }[];
}

export default function FreelancerProfileScreen({ route, navigation }: Props) {
  const { freelancerId } = route.params;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: fp, error: fpErr } = await supabase
          .from('freelancer_profiles')
          .select(`
            bio, hourly_rate, availability, service_categories, verification_status,
            users!inner(full_name, avatar_url, city, state),
            portfolio_items(id, media_url, media_type, title)
          `)
          .eq('id', freelancerId)
          .single();

        if (fpErr) throw fpErr;

        const u = Array.isArray(fp.users) ? fp.users[0] : fp.users;

        setProfile({
          full_name: u.full_name,
          avatar_url: u.avatar_url,
          city: u.city,
          state: u.state,
          bio: fp.bio,
          hourly_rate: fp.hourly_rate,
          availability: fp.availability,
          service_categories: fp.service_categories ?? [],
          verification_status: fp.verification_status,
          portfolio_items: fp.portfolio_items ?? [],
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [freelancerId]);

  const avatarUrl = profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl
    : null;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Profile not found'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const availLabel: Record<string, string> = {
    full_time: 'Full-time',
    part_time: 'Part-time',
    contract: 'Contract',
    unavailable: 'Unavailable',
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{profile.full_name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile.full_name}</Text>
              {profile.verification_status === 'approved' && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓</Text>
                </View>
              )}
            </View>
            {(profile.city || profile.state) && (
              <Text style={styles.location}>
                {[profile.city, profile.state].filter(Boolean).join(', ')}
              </Text>
            )}
            <Text style={styles.avail}>{availLabel[profile.availability] ?? profile.availability}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {profile.hourly_rate != null && (
            <View style={styles.statBox}>
              <Text style={styles.statValue}>${profile.hourly_rate}</Text>
              <Text style={styles.statLabel}>per hour</Text>
            </View>
          )}
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{profile.portfolio_items.length}</Text>
            <Text style={styles.statLabel}>portfolio items</Text>
          </View>
        </View>

        {profile.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        ) : null}

        {profile.service_categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services</Text>
            <View style={styles.chips}>
              {profile.service_categories.map((cat) => (
                <View key={cat} style={styles.chip}>
                  <Text style={styles.chipText}>{cat}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {profile.portfolio_items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
              {profile.portfolio_items.map((p) => {
                const url = supabase.storage.from('portfolios').getPublicUrl(p.media_url).data.publicUrl;
                return (
                  <View key={p.id} style={styles.portfolioItem}>
                    <Image source={{ uri: url }} style={styles.portfolioThumb} resizeMode="cover" />
                    {p.media_type === 'video' && (
                      <View style={styles.videoIndicator}>
                        <Text style={styles.videoPlay}>▶</Text>
                      </View>
                    )}
                    {p.title ? <Text style={styles.portfolioTitle} numberOfLines={1}>{p.title}</Text> : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity style={styles.contactBtn}>
          <Text style={styles.contactBtnText}>Send Message</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl + 20 },
  closeBtn: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: colors.white, fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, marginRight: spacing.md, borderWidth: 2, borderColor: colors.primary },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryDark,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  avatarInitial: { color: colors.white, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold },
  headerInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  name: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, marginRight: spacing.xs },
  verifiedBadge: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedText: { color: colors.white, fontSize: 10, fontWeight: typography.fontWeight.bold },
  location: { color: colors.textSecondary, fontSize: typography.fontSize.sm, marginBottom: 2 },
  avail: { color: colors.primary, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  statBox: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center',
  },
  statValue: { color: colors.primary, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold },
  statLabel: { color: colors.textSecondary, fontSize: typography.fontSize.xs, marginTop: 2 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm },
  bioText: { color: colors.textSecondary, fontSize: typography.fontSize.sm, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: 'rgba(46,204,113,0.15)', borderWidth: 1, borderColor: colors.primary,
    borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  chipText: { color: colors.primaryLight, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium },
  portfolioScroll: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg },
  portfolioItem: { marginRight: spacing.md, width: 140 },
  portfolioThumb: { width: 140, height: 140, borderRadius: borderRadius.md, backgroundColor: colors.surface },
  videoIndicator: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
  },
  videoPlay: { color: colors.white, fontSize: 28 },
  portfolioTitle: { color: colors.textSecondary, fontSize: typography.fontSize.xs, marginTop: 4 },
  contactBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl,
  },
  contactBtnText: { color: colors.black, fontWeight: typography.fontWeight.bold, fontSize: typography.fontSize.base },
  errorText: { color: colors.error, fontSize: typography.fontSize.base, marginBottom: spacing.md },
  backBtn: { backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backBtnText: { color: colors.white, fontWeight: typography.fontWeight.medium },
});
