import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { blockUser } from '../../services/safetyService';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface Props {
  visible: boolean;
  blockedUserId: string;
  blockedUserName: string;
  onClose: () => void;
  onBlocked?: () => void;
}

export default function BlockConfirmModal({
  visible,
  blockedUserId,
  blockedUserName,
  onClose,
  onBlocked,
}: Props) {
  const [blocking, setBlocking] = useState(false);

  async function handleConfirm() {
    setBlocking(true);
    try {
      await blockUser(blockedUserId);
      onClose();
      onBlocked?.();
    } catch {
      Alert.alert('Error', 'Failed to block user. Please try again.');
    } finally {
      setBlocking(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Block {blockedUserName}?</Text>
          <Text style={styles.body}>
            Blocking {blockedUserName} will remove them from your feed and prevent all future contact.
            {'\n\n'}
            This cannot be undone.
          </Text>

          <TouchableOpacity
            style={[styles.btn, styles.blockBtn, blocking && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={blocking}
            activeOpacity={0.85}
          >
            {blocking ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.blockBtnText}>Block</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.cancelBtn]}
            onPress={onClose}
            disabled={blocking}
            activeOpacity={0.75}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    lineHeight: 21,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  btn: {
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  btnDisabled: { opacity: 0.5 },
  blockBtn: { backgroundColor: colors.error },
  blockBtnText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  cancelBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
});
