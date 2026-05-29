import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  PanResponder,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { getOrCreateConversation } from '../services/messagingService';
import { haversineDistanceMiles } from '../utils/haversine';
import { colors, typography, spacing, borderRadius } from '../theme';
import { RootStackParamList } from '../navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface ShortlistEntry {
  shortlistId: string;
  freelancerId: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  serviceCategories: string[];
  hourlyRate: number | null;
  avgRating: number | null;
}

const SWIPE_THRESHOLD = -80;

function ShortlistCard({
  entry,
  myLat,
  myLng,
  onPress,
  onMessage,
  onRemove,
}: {
  entry: ShortlistEntry;
  myLat: number | null;
  myLng: number | null;
  onPress: () => void;
  onMessage: () => void;
  onRemove: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const removing = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8 && dx < 0,
      onPanResponderMove: (_, { dx }) => {
        if (dx < 0) translateX.setValue(dx);
      },
      onPanResponderRelease: (_, { dx }) => {
        if (dx <= SWIPE_THRESHOLD && !removing.current) {
          removing.current = true;
          Animated.timing(translateX, {
            toValue: -400,
            duration: 220,
            useNativeDriver: true,
          }).start(() => onRemove());
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const avatarUrl = entry.avatarUrl
    ? supabase.storage.from('avatars').getPublicUrl(entry.avatarUrl).data.publicUrl
    : null;

  const distanceLabel =
    myLat != null && myLng != null && entry.lat != null && entry.lng != null
      ? haversineDistanceMiles(myLat, myLng, entry.lat, entry.lng)
      : null;

  const distText =
    distanceLabel != null
      ? distanceLabel < 1
        ? '< 1 mi'
        : `${Math.round(distanceLabel)} mi`
      : null;

  const category = entry.serviceCategories[0] ?? null;
  const stars = entry.avgRating != null ? Math.round(entry.avgRating) : null;

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
      {/* Delete hint behind card */}
      <View style={styles.deleteHint}>
        <Text style={styles.deleteHintText}>🗑 Remove</Text>
      </View>

      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
        {/* Avatar */}
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{entry.fullName.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{entry.fullName}</Text>
          {category && (
            <Text style={styles.category} numberOfLines={1}>{category}</Text>
          )}
          <View style={styles.metaRow}>
            {stars != null && (
              <Text style={styles.rating}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)} {entry.avgRating?.toFixed(1)}</Text>
            )}
            {distText && (
              <Text style={styles.distance}>{distText}</Text>
            )}
            {entry.hourlyRate != null && (
              <Text style={styles.rate}>${entry.hourlyRate}/hr</Text>
            )}
          </View>
        </View>

        {/* Message button */}
        <TouchableOpacity
          style={styles.msgBtn}
          onPress={(e) => { e.stopPropagation(); onMessage(); }}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.msgBtnText}>Message</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ShortlistScreen() {
  const navigation = useNavigation<NavProp>();
  const { user, profile } = useAuth();

  const [entries, setEntries] = useState<ShortlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const myLat = profile?.lat ?? null;
  const myLng = profile?.lng ?? null;

  const load = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('shortlists')
      .select(`
        id,
        freelancer_user_id
      `)
      .eq('business_user_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !data) return;

    const freelancerUserIds = data.map((d) => d.freelancer_user_id);
    if (freelancerUserIds.length === 0) {
      setEntries([]);
      return;
    }

    const [fpRes, usersRes, reviewsRes] = await Promise.all([
      supabase
        .from('freelancer_profiles')
        .select('id, user_id, hourly_rate, service_categories')
        .in('user_id', freelancerUserIds),
      supabase
        .from('users')
        .select('id, full_name, avatar_url, city, state, lat, lng')
        .in('id', freelancerUserIds),
      supabase
        .from('reviews')
        .select('reviewee_id, rating')
        .in('reviewee_id', freelancerUserIds),
    ]);

    const fpMap = new Map((fpRes.data ?? []).map((fp: any) => [fp.user_id, fp]));
    const userMap = new Map((usersRes.data ?? []).map((u: any) => [u.id, u]));

    // Compute average rating per freelancer
    const ratingMap = new Map<string, { sum: number; count: number }>();
    for (const r of reviewsRes.data ?? []) {
      const curr = ratingMap.get(r.reviewee_id) ?? { sum: 0, count: 0 };
      ratingMap.set(r.reviewee_id, { sum: curr.sum + r.rating, count: curr.count + 1 });
    }

    const result: ShortlistEntry[] = data.map((d) => {
      const fp = fpMap.get(d.freelancer_user_id);
      const u = userMap.get(d.freelancer_user_id);
      const ratData = ratingMap.get(d.freelancer_user_id);
      return {
        shortlistId: d.id,
        freelancerId: fp?.id ?? '',
        userId: d.freelancer_user_id,
        fullName: u?.full_name ?? 'Unknown',
        avatarUrl: u?.avatar_url ?? null,
        city: u?.city ?? null,
        state: u?.state ?? null,
        lat: u?.lat ?? null,
        lng: u?.lng ?? null,
        serviceCategories: fp?.service_categories ?? [],
        hourlyRate: fp?.hourly_rate ?? null,
        avgRating: ratData ? ratData.sum / ratData.count : null,
      };
    });

    setEntries(result);
  }, [user]);

  useEffect(() => {
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const handleRemove = useCallback(async (shortlistId: string) => {
    setEntries((prev) => prev.filter((e) => e.shortlistId !== shortlistId));
    await supabase.from('shortlists').delete().eq('id', shortlistId);
  }, []);

  const handleMessage = useCallback(
    async (entry: ShortlistEntry) => {
      if (!user) return;
      try {
        const convId = await getOrCreateConversation(user.id, entry.userId);
        navigation.navigate('Chat', {
          conversationId: convId,
          otherUserId: entry.userId,
          otherUserName: entry.fullName,
          otherUserAvatar: entry.avatarUrl,
        });
      } catch {}
    },
    [user, navigation],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved Freelancers</Text>
        <Text style={styles.headerSub}>{entries.length} saved</Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.shortlistId}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={entries.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No saved freelancers yet</Text>
            <Text style={styles.emptySub}>Swipe right on freelancers in the feed to save them here.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ShortlistCard
            entry={item}
            myLat={myLat}
            myLng={myLng}
            onPress={() =>
              item.freelancerId
                ? navigation.navigate('FreelancerProfile', { freelancerId: item.freelancerId })
                : undefined
            }
            onMessage={() => handleMessage(item)}
            onRemove={() => handleRemove(item.shortlistId)}
          />
        )}
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
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 80,
  },
  emptyContainer: {
    flex: 1,
    padding: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cardWrap: {
    marginBottom: spacing.sm,
    position: 'relative',
  },
  deleteHint: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    borderRadius: borderRadius.lg,
  },
  deleteHintText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.primary,
    marginRight: spacing.sm,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarInitial: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  info: { flex: 1, marginRight: spacing.sm },
  name: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  category: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  rating: {
    fontSize: typography.fontSize.xs,
    color: colors.warning,
  },
  distance: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
  rate: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  msgBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  msgBtnText: {
    color: colors.black,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
});
