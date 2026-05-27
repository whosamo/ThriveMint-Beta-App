import React, { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, hint, secureTextEntry, style, ...rest }, ref) => {
    const [hidden, setHidden] = useState(secureTextEntry ?? false);
    const isPassword = !!secureTextEntry;

    return (
      <View style={styles.wrapper}>
        {label ? <Text style={styles.label}>{label}</Text> : null}

        <View style={[styles.row, !!error && styles.rowError]}>
          <TextInput
            ref={ref}
            style={[styles.input, style]}
            secureTextEntry={hidden}
            placeholderTextColor={colors.gray600}
            autoCapitalize="none"
            autoCorrect={false}
            {...rest}
          />
          {isPassword ? (
            <TouchableOpacity onPress={() => setHidden((h) => !h)} style={styles.eye}>
              <Text style={styles.eyeIcon}>{hidden ? '👁' : '🙈'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : hint ? (
          <Text style={styles.hint}>{hint}</Text>
        ) : null}
      </View>
    );
  },
);

Input.displayName = 'Input';
export default Input;

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  rowError: { borderColor: colors.error },
  input: {
    flex: 1,
    height: 50,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  eye: { padding: spacing.xs },
  eyeIcon: { fontSize: 16 },
  error: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.error,
  },
  hint: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
});
