import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { colors, typography, spacing, borderRadius } from '../theme';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

interface InsightCache {
  tip: string;
  fetchedAt: number;
}

const INSIGHT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function notifIcon(type: string): string {
  switch (type) {
    case 'shortlist': return '❤️';
    case 'message': return '💬';
    case 'milestone': return '💰';
    case 'suspension': return '⚠️';
    default: return '🔔';
  }
}

export default function FreelancerNotificationsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data as Notification[]) ?? []);
  }, [user]);

  const loadInsight = useCallback(async () => {
    if (!user) return;
    const cacheKey = `freelancer_insight_${user.id}`;
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed: InsightCache = JSON.parse(cached);
        if (Date.now() - parsed.fetchedAt < INSIGHT_TTL_MS) {
          setInsight(parsed.tip);
          return;
        }
      }
    } catch {}

    setInsightLoading(true);
    try {
      // Gather stats for insight
      const [fpRes, pvRes, slRes, portRes] = await Promise.all([
        supabase
          .from('freelancer_profiles')
          .select('id, bio, hourly_rate, service_categories')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('profile_views')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('shortlists')
          .select('id', { count: 'exact', head: true })
          .eq('freelancer_user_id', user.id),
        null as any,
      ]);

      const fp = fpRes.data as any;
      let portfolioCount = 0;
      if (fp?.id) {
        const portRes2 = await supabase
          .from('portfolio_items')
          .select('id', { count: 'exact', head: true })
          .eq('freelancer_id', fp.id);
        portfolioCount = portRes2.count ?? 0;
      }

      let profileViewsWeek = 0;
      if (fp?.id) {
        const pvRes2 = await supabase
          .from('profile_views')
          .select('id', { count: 'exact', head: true })
          .eq('freelancer_id', fp.id)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        profileViewsWeek = pvRes2.count ?? 0;
      }

      const { data: insightData, error } = await supabase.functions.invoke('freelancer-insight', {
        body: {
          stats: {
            profileViewsWeek,
            shortlistCount: slRes.count ?? 0,
            portfolioCount,
          },
          profile: {
            bio: fp?.bio ?? null,
            serviceCategories: fp?.service_categories ?? [],
            hourlyRate: fp?.hourly_rate ?? null,
          },
        },
      });

      if (!error && insightData?.tip) {
        setInsight(insightData.tip);
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({ tip: insightData.tip, fetchedAt: Date.now() } satisfies InsightCache),
        );
      }
    } catch {}
    setInsightLoading(false);
  }, [user]);

  useEffect(() => {
    Promise.all([loadNotifications(), loadInsight()]).finally(() => setIsLoading(false));
  }, [loadNotifications, loadInsight]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  }, [loadNotifications]);

  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={() => (
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Text style={styles.insightHeaderIcon}>✦</Text>
              <Text style={styles.insightHeaderTitle}>Weekly AI Tip</Text>
            </View>
            {insightLoading ? (
              <ActivityIndicator color={colors.primary} size="small" style={{ marginTop: spacing.xs }} />
            ) : insight ? (
              <Text style={styles.insightText}>{insight}</Text>
            ) : (
              <Text style={styles.insightEmpty}>Complete your profile to get personalised tips.</Text>
            )}
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No notifications yet.</Text>
            <Text style={styles.emptySubText}>We'll notify you when a business shortlists you or sends a message.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.notifRow, !item.is_read && styles.notifRowUnread]}
            onPress={() => markRead(item.id)}
            activeOpacity={0.75}
          >
            <View style={styles.notifIconWrap}>
              <Text style={styles.notifIcon}>{notifIcon(item.type)}</Text>
            </View>
            <View style={styles.notifBody}>
              <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]}>
                {item.title}
              </Text>
              <Text style={styles.notifText} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
            </View>
            {!item.is_read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    color: colors.textSecondary,
    fontSize: 28,
    lineHeight: 30,
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  listContent: {
    paddingBottom: 80,
  },
  insightCard: {
    margin: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  insightHeaderIcon: {
    fontSize: 14,
    color: colors.primary,
  },
  insightHeaderTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  insightText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  insightEmpty: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifRowUnread: {
    borderColor: 'rgba(46,204,113,0.3)',
    backgroundColor: 'rgba(46,204,113,0.05)',
  },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  notifIcon: { fontSize: 18 },
  notifBody: { flex: 1 },
  notifTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  notifTitleUnread: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  notifText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginLeft: spacing.xs,
    flexShrink: 0,
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  emptySubText: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
