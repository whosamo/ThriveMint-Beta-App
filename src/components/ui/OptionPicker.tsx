import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../theme';

interface OptionPickerProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  columns?: 2 | 3 | 4;
}

export default function OptionPicker({
  options,
  value,
  onChange,
  columns = 2,
}: OptionPickerProps) {
  // Percentage per cell accounting for gap shrinkage
  const pct = columns === 4 ? '22%' : columns === 3 ? '30%' : '47%';

  return (
    <View style={styles.grid}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            activeOpacity={0.7}
            style={[styles.pill, { width: pct }, active && styles.pillActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  pillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '22',
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  labelActive: { color: colors.primary },
});
