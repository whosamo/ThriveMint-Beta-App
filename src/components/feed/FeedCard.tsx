import React, { useRef, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { FeedItem } from '../../types/feed';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { supabase } from '../../services/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

interface Props {
  item: FeedItem;
  isFocused: boolean;
  onShortlist: (freelancerId: string) => void;
  onPress: (freelancerId: string) => void;
}

export default function FeedCard({ item, isFocused, onShortlist, onPress }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  const triggerShortlist = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: 60, useNativeDriver: true, speed: 20 }),
      Animated.timing(heartOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 20 }),
        Animated.timing(heartOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      onShortlist(item.user_id);
    });
  }, [translateX, heartOpacity, onShortlist, item.freelancer_id]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
      onPanResponderMove: (_, { dx }) => {
        if (dx > 0) translateX.setValue(dx);
      },
      onPanResponderRelease: (_, { dx }) => {
        if (dx >= SWIPE_THRESHOLD) {
          triggerShortlist();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const mediaUrl = item.portfolio_media_url
    ? supabase.storage.from('portfolios').getPublicUrl(item.portfolio_media_url).data.publicUrl
    : null;

  const avatarUrl = item.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(item.avatar_url).data.publicUrl
    : null;

  const distanceLabel =
    item.distance_miles != null
      ? item.distance_miles < 1
        ? '< 1 mi'
        : `${Math.round(item.distance_miles)} mi`
      : null;

  const rateLabel = item.hourly_rate != null ? `$${item.hourly_rate}/hr` : null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX }] }]}
      {...panResponder.panHandlers}
    >
      <TouchableWithoutFeedback onPress={() => onPress(item.freelancer_id)}>
        <View style={StyleSheet.absoluteFillObject}>
          {mediaUrl && item.portfolio_media_type === 'video' ? (
            <Video
              source={{ uri: mediaUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode={ResizeMode.COVER}
              isLooping
              isMuted={false}
              shouldPlay={isFocused}
            />
          ) : mediaUrl ? (
            <Image
              source={{ uri: mediaUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.noMedia]} />
          )}

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.85)']}
            locations={[0.3, 0.65, 1]}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      </TouchableWithoutFeedback>

      {/* Heart overlay on swipe */}
      <Animated.View style={[styles.heartOverlay, { opacity: heartOpacity }]}>
        <Text style={styles.heartEmoji}>❤️</Text>
      </Animated.View>

      {/* Info overlay */}
      <TouchableWithoutFeedback onPress={() => onPress(item.freelancer_id)}>
        <View style={styles.infoOverlay} pointerEvents="box-none">
          <View style={styles.avatarRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {item.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.nameBlock}>
              <Text style={styles.name} numberOfLines={1}>{item.full_name}</Text>
              {(item.city || item.state) && (
                <Text style={styles.location} numberOfLines={1}>
                  {[item.city, item.state].filter(Boolean).join(', ')}
                </Text>
              )}
            </View>
            {item.verification_status === 'approved' && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            )}
          </View>

          {item.bio ? (
            <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text>
          ) : null}

          {item.service_categories.length > 0 && (
            <View style={styles.chips}>
              {item.service_categories.slice(0, 3).map((cat) => (
                <View key={cat} style={styles.chip}>
                  <Text style={styles.chipText}>{cat}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              {rateLabel && (
                <View style={styles.rateBadge}>
                  <Text style={styles.rateText}>{rateLabel}</Text>
                </View>
              )}
              {distanceLabel && (
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>{distanceLabel}</Text>
                </View>
              )}
              {item.accepting_new_work && item.is_available_today && (
                <View style={styles.availNowBadge}>
                  <Text style={styles.availNowText}>● Available now</Text>
                </View>
              )}
            </View>
            <View style={styles.availBadge}>
              <Text style={styles.availText}>
                {item.availability === 'full_time'
                  ? 'Full-time'
                  : item.availability === 'part_time'
                  ? 'Part-time'
                  : item.availability === 'contract'
                  ? 'Contract'
                  : 'Unavailable'}
              </Text>
            </View>
          </View>

          <Text style={styles.swipeHint}>Swipe right to shortlist →</Text>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: colors.background,
  },
  noMedia: {
    backgroundColor: colors.surface,
  },
  heartOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  heartEmoji: {
    fontSize: 80,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + 60,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
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
  nameBlock: { flex: 1 },
  name: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2,
  },
  location: {
    color: colors.gray300,
    fontSize: typography.fontSize.sm,
  },
  verifiedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  verifiedText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
  },
  bio: {
    color: colors.gray200,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * 1.5,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    backgroundColor: 'rgba(46,204,113,0.2)',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipText: {
    color: colors.primaryLight,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  footerLeft: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  rateBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rateText: {
    color: colors.black,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  distanceBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  distanceText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  availNowBadge: {
    backgroundColor: 'rgba(46,204,113,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.6)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  availNowText: {
    color: '#2ECC71',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  availBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  availText: {
    color: colors.gray300,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  swipeHint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
