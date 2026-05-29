import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFeed } from '../hooks/useFeed';
import { useBriefContext } from '../context/BriefContext';
import FeedCard from '../components/feed/FeedCard';
import FeedCardSkeleton from '../components/feed/FeedCardSkeleton';
import { FeedItem } from '../types/feed';
import { colors, typography, spacing } from '../theme';
import { supabase } from '../services/supabase';
import { RootStackParamList } from '../navigation/RootNavigator';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function FeedScreen() {
  const { activeBriefMatch, clearBriefMatch } = useBriefContext();
  const { items, isLoading, isLoadingMore, hasMore, error, refresh, loadMore } = useFeed(activeBriefMatch);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const navigation = useNavigation<NavProp>();

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setFocusedIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const handleShortlist = useCallback(async (freelancerId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('shortlists')
      .upsert({ business_user_id: user.id, freelancer_user_id: freelancerId });
  }, []);

  const handlePress = useCallback(
    (freelancerId: string) => {
      navigation.navigate('FreelancerProfile', { freelancerId });
    },
    [navigation],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<FeedItem> | null | undefined, index: number) => ({
      length: SCREEN_HEIGHT,
      offset: SCREEN_HEIGHT * index,
      index,
    }),
    [],
  );

  const keyExtractor = useCallback((item: FeedItem) => item.freelancer_id, []);

  const renderItem = useCallback(
    ({ item, index }: { item: FeedItem; index: number }) => (
      <FeedCard
        item={item}
        isFocused={index === focusedIndex}
        onShortlist={handleShortlist}
        onPress={handlePress}
      />
    ),
    [focusedIndex, handleShortlist, handlePress],
  );

  const ListFooter = useCallback(() => {
    if (isLoadingMore) return <FeedCardSkeleton />;
    if (!hasMore && items.length > 0) {
      return (
        <View style={styles.endMessage}>
          <Text style={styles.endText}>You've seen everyone nearby.</Text>
          <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  }, [isLoadingMore, hasMore, items.length, refresh]);

  if (isLoading) {
    return (
      <View style={styles.fullScreen}>
        <FeedCardSkeleton />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredMessage}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centeredMessage}>
        <Text style={styles.emptyTitle}>No freelancers found nearby</Text>
        <Text style={styles.emptySubtitle}>Try expanding your search radius in your profile settings.</Text>
        <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.fullScreen}>
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        pagingEnabled
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={ListFooter}
        removeClippedSubviews
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
      />

      {/* Brief match banner */}
      {activeBriefMatch && (
        <View style={styles.briefBanner}>
          <Text style={styles.briefBannerText} numberOfLines={1}>
            ✦ Matching: {activeBriefMatch.brief_title}
          </Text>
          <TouchableOpacity onPress={clearBriefMatch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.briefBannerClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('BriefGenerator')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>✦ What do you need?</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centeredMessage: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  refreshBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  refreshText: {
    color: colors.black,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.sm,
  },
  endMessage: {
    height: SCREEN_HEIGHT,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  endText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  briefBanner: {
    position: 'absolute',
    top: 52,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(46,204,113,0.18)',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  briefBannerText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
    marginRight: spacing.sm,
  },
  briefBannerClose: {
    color: colors.primary,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: colors.black,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.3,
  },
});
