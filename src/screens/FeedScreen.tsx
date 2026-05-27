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
import FeedCard from '../components/feed/FeedCard';
import FeedCardSkeleton from '../components/feed/FeedCardSkeleton';
import { FeedItem } from '../types/feed';
import { colors, typography, spacing } from '../theme';
import { supabase } from '../services/supabase';
import { RootStackParamList } from '../navigation/RootNavigator';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function FeedScreen() {
  const { items, isLoading, isLoadingMore, hasMore, error, refresh, loadMore } = useFeed();
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
      .upsert({ business_user_id: user.id, freelancer_id: freelancerId });
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
});
