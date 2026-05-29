import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface Props {
  visible: boolean;
  milestoneTitle: string;
  amount: number;
  freelancerName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function MilestoneReleaseConfirmModal({
  visible,
  milestoneTitle,
  amount,
  freelancerName,
  onConfirm,
  onCancel,
}: Props) {
  const [isReleasing, setIsReleasing] = useState(false);

  async function handleConfirm() {
    setIsReleasing(true);
    try {
      await onConfirm();
    } finally {
      setIsReleasing(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.icon}>💸</Text>
          <Text style={styles.title}>Release Milestone?</Text>
          <Text style={styles.subtitle}>{milestoneTitle}</Text>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>You're about to release</Text>
            <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
            <Text style={styles.amountTo}>to {freelancerName}</Text>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ This cannot be undone.</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={isReleasing}
              activeOpacity={0.75}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, isReleasing && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={isReleasing}
              activeOpacity={0.8}
            >
              {isReleasing ? (
                <ActivityIndicator color={colors.black} size="small" />
              ) : (
                <Text style={styles.confirmText}>Release ${amount.toFixed(2)}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  icon: { fontSize: 40, marginBottom: spacing.sm },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  amountBox: {
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  amountLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  amountValue: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  amountTo: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  warningBox: {
    marginBottom: spacing.lg,
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  confirmBtn: {
    flex: 2,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmText: {
    color: colors.black,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
