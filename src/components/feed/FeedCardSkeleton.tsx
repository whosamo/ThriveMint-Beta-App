import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { colors, borderRadius, spacing } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function ShimmerBox({ style }: { style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);

  return <Animated.View style={[{ opacity, backgroundColor: colors.surface }, style]} />;
}

export default function FeedCardSkeleton() {
  return (
    <View style={styles.container}>
      <ShimmerBox style={StyleSheet.absoluteFillObject} />
      <View style={styles.overlay}>
        <View style={styles.avatarRow}>
          <ShimmerBox style={styles.avatar} />
          <View style={styles.nameBlock}>
            <ShimmerBox style={styles.nameLine} />
            <ShimmerBox style={styles.subLine} />
          </View>
        </View>
        <ShimmerBox style={styles.bioLine} />
        <ShimmerBox style={[styles.bioLine, { width: '60%' }]} />
        <View style={styles.chips}>
          {[80, 100, 70].map((w, i) => (
            <ShimmerBox key={i} style={[styles.chip, { width: w }]} />
          ))}
        </View>
        <View style={styles.footer}>
          <ShimmerBox style={styles.rateBox} />
          <ShimmerBox style={styles.distanceBox} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: colors.background,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 60,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: spacing.sm,
  },
  nameBlock: { flex: 1, gap: spacing.xs },
  nameLine: { height: 18, borderRadius: borderRadius.sm, width: '60%' },
  subLine: { height: 14, borderRadius: borderRadius.sm, width: '40%' },
  bioLine: { height: 14, borderRadius: borderRadius.sm, width: '90%', marginBottom: spacing.xs },
  chips: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.md },
  chip: { height: 28, borderRadius: borderRadius.full },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  rateBox: { height: 32, width: 100, borderRadius: borderRadius.md },
  distanceBox: { height: 32, width: 80, borderRadius: borderRadius.md },
});
