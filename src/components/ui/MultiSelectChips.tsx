import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../theme';

interface MultiSelectChipsProps {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  maxSelect?: number;
}

export default function MultiSelectChips({
  options,
  selected,
  onChange,
  maxSelect,
}: MultiSelectChipsProps) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      if (maxSelect && selected.length >= maxSelect) return;
      onChange([...selected, opt]);
    }
  };

  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => toggle(opt)}
            activeOpacity={0.7}
            style={[styles.chip, active && styles.chipActive]}
          >
            {active ? <Text style={styles.check}>✓ </Text> : null}
            <Text style={[styles.label, active && styles.labelActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '22',
  },
  check: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  labelActive: { color: colors.primary },
});
