import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { colors, typography, spacing, borderRadius } from '../theme';
import { RootStackParamList } from '../navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface Stats {
  profileViewsWeek: number;
  shortlistCount: number;
  activeProjects: number;
  portfolioCount: number;
}

interface FreelancerProfileData {
  id: string;
  bio: string | null;
  hourly_rate: number | null;
  service_categories: string[];
  availability: string | null;
  accepting_new_work: boolean;
}

function completionScore(
  userProfile: { avatar_url: string | null },
  fp: FreelancerProfileData,
  portfolioCount: number,
): { pct: number; tips: string[] } {
  const tips: string[] = [];
  let score = 0;

  if (userProfile.avatar_url) {
    score += 20;
  } else {
    tips.push('Add a profile photo to build trust');
  }
  if (fp.bio && fp.bio.length > 20) {
    score += 20;
  } else {
    tips.push('Write a bio to tell clients about yourself');
  }
  if (fp.service_categories.length > 0) {
    score += 20;
  } else {
    tips.push('Add your service categories');
  }
  if (fp.hourly_rate != null) {
    score += 15;
  } else {
    tips.push('Set your hourly rate to appear in searches');
  }
  if (portfolioCount > 0) {
    score += 25;
  } else {
    tips.push('Upload a video reel to get 3× more views');
  }

  return { pct: score, tips: tips.slice(0, 2) };
}

export default function FreelancerHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { user, profile } = useAuth();

  const [fpData, setFpData] = useState<FreelancerProfileData | null>(null);
  const [stats, setStats] = useState<Stats>({ profileViewsWeek: 0, shortlistCount: 0, activeProjects: 0, portfolioCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;

    const [fpRes, pvRes, slRes, contRes, portRes] = await Promise.all([
      supabase
        .from('freelancer_profiles')
        .select('id, bio, hourly_rate, service_categories, availability, accepting_new_work')
        .eq('user_id', user.id)
        .maybeSingle(),
      // profile views in last 7 days
      supabase
        .from('profile_views')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      // shortlist count
      supabase
        .from('shortlists')
        .select('id', { count: 'exact', head: true })
        .eq('freelancer_user_id', user.id),
      // active contracts
      supabase
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('freelancer_user_id', user.id)
        .eq('status', 'active'),
      // portfolio count — needs freelancer_id
      null as any,
    ]);

    const fp = fpRes.data as FreelancerProfileData | null;
    setFpData(fp);

    let portfolioCount = 0;
    if (fp?.id) {
      const portRes2 = await supabase
        .from('portfolio_items')
        .select('id', { count: 'exact', head: true })
        .eq('freelancer_id', fp.id);
      portfolioCount = portRes2.count ?? 0;
    }

    // profile_views query needs freelancer_id too
    let profileViewsWeek = 0;
    if (fp?.id) {
      const pvRes2 = await supabase
        .from('profile_views')
        .select('id', { count: 'exact', head: true })
        .eq('freelancer_id', fp.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      profileViewsWeek = pvRes2.count ?? 0;
    }

    setStats({
      profileViewsWeek,
      shortlistCount: slRes.count ?? 0,
      activeProjects: contRes.count ?? 0,
      portfolioCount,
    });
  }, [user]);

  useEffect(() => {
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const { pct, tips } = completionScore(
    { avatar_url: profile?.avatar_url ?? null },
    fpData ?? { id: '', bio: null, hourly_rate: null, service_categories: [], availability: null, accepting_new_work: true },
    stats.portfolioCount,
  );

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {firstName} 👋</Text>
          <Text style={styles.subGreeting}>Here's how you're performing</Text>
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('FreelancerNotifications')}
          activeOpacity={0.75}
        >
          <Text style={styles.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Completion */}
      <View style={styles.card}>
        <View style={styles.completionHeader}>
          <Text style={styles.cardTitle}>Profile Completion</Text>
          <Text style={[styles.completionPct, pct === 100 && styles.completionPctDone]}>
            {pct}%
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
        </View>
        {tips.length > 0 && (
          <View style={styles.tipsBox}>
            {tips.map((tip, i) => (
              <Text key={i} style={styles.tipText}>✦ {tip}</Text>
            ))}
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.profileViewsWeek}</Text>
          <Text style={styles.statLabel}>Profile Views</Text>
          <Text style={styles.statSub}>this week</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.shortlistCount}</Text>
          <Text style={styles.statLabel}>Shortlisted</Text>
          <Text style={styles.statSub}>all time</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.activeProjects}</Text>
          <Text style={styles.statLabel}>Projects</Text>
          <Text style={styles.statSub}>active</Text>
        </View>
        <View style={[styles.statCard, styles.statCardLocked]}>
          <Text style={styles.statValueLocked}>$—</Text>
          <Text style={styles.statLabel}>Earnings</Text>
          <Text style={styles.statSubLocked}>coming soon</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsCol}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('PortfolioUpload')}
          activeOpacity={0.75}
        >
          <Text style={styles.actionIcon}>🎬</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionLabel}>Upload Content</Text>
            <Text style={styles.actionSub}>Add portfolio videos, photos & testimonials</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('FreelancerNotifications')}
          activeOpacity={0.75}
        >
          <Text style={styles.actionIcon}>❤️</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionLabel}>View Shortlists</Text>
            <Text style={styles.actionSub}>See which businesses saved your profile</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('ProfileEdit')}
          activeOpacity={0.75}
        >
          <Text style={styles.actionIcon}>✏️</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionLabel}>Edit Profile</Text>
            <Text style={styles.actionSub}>Update your bio, rate and services</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Availability')}
          activeOpacity={0.75}
        >
          <Text style={styles.actionIcon}>📅</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionLabel}>Set Availability</Text>
            <Text style={styles.actionSub}>Let businesses know when you're open</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: 60,
    paddingBottom: 100,
    paddingHorizontal: spacing.lg,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  subGreeting: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  completionPct: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning,
  },
  completionPctDone: {
    color: colors.primary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  tipsBox: { gap: spacing.xs },
  tipText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
  },
  statCardLocked: {
    opacity: 0.5,
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  statValueLocked: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginTop: 2,
    textAlign: 'center',
  },
  statSub: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  statSubLocked: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  actionsCol: { gap: spacing.sm },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  actionIcon: { fontSize: 22, marginRight: spacing.md },
  actionText: { flex: 1 },
  actionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  actionSub: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  actionChevron: {
    fontSize: 22,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
});
