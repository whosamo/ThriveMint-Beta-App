import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../theme';

interface StepIndicatorProps {
  current: number;
  total: number;
  title?: string;
}

export default function StepIndicator({ current, total, title }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.track}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              i < current ? styles.done : styles.idle,
            ]}
          />
        ))}
      </View>
      <View style={styles.meta}>
        {title ? <Text style={styles.title}>{title}</Text> : <View />}
        <Text style={styles.counter}>
          {current} / {total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.xl },
  track: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: borderRadius.full,
  },
  done: { backgroundColor: colors.primary },
  idle: { backgroundColor: colors.border },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  counter: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
});
