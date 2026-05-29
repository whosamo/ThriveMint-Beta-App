import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export default function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={isDisabled}
      style={[
        styles.base,
        styles[variant],
        styles[`sz_${size}` as keyof typeof styles] as ViewStyle,
        isDisabled && styles.disabled,
        style as ViewStyle,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.background : colors.primary}
        />
      ) : (
        <Text
          style={[
            styles.label,
            styles[`lv_${variant}` as keyof typeof styles] as TextStyle,
            styles[`ls_${size}` as keyof typeof styles] as TextStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: { backgroundColor: 'transparent' },

  sz_sm: { height: 36, paddingHorizontal: spacing.md },
  sz_md: { height: 50, paddingHorizontal: spacing.lg },
  sz_lg: { height: 56, paddingHorizontal: spacing.xl },

  disabled: { opacity: 0.45 },

  label: { fontWeight: typography.fontWeight.semibold },
  lv_primary: { color: colors.background },
  lv_secondary: { color: colors.textPrimary },
  lv_ghost: { color: colors.primary },

  ls_sm: { fontSize: typography.fontSize.sm },
  ls_md: { fontSize: typography.fontSize.base },
  ls_lg: { fontSize: typography.fontSize.md },
});
