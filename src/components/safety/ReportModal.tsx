import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { submitReport } from '../../services/safetyService';
import { ContentType, ReportPayload, ReportReason, REPORT_REASONS } from '../../types/safety';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface Props {
  visible: boolean;
  reportedUserId: string;
  reportedUserName: string;
  contentType: ContentType;
  contentId?: string;
  onClose: () => void;
}

export default function ReportModal({
  visible,
  reportedUserId,
  reportedUserName,
  contentType,
  contentId,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setSelectedReason(null);
    setDetails('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      const payload: ReportPayload = {
        reportedUserId,
        contentType,
        contentId,
        reason: selectedReason,
        details: details.trim() || undefined,
      };
      await submitReport(payload);
      reset();
      onClose();
      Alert.alert('Report submitted', 'Thank you. Our team will review this report within 24 hours.');
    } catch {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetWrap}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          {/* Handle */}
          <View style={styles.handle} />

          <Text style={styles.title}>Report {reportedUserName}</Text>
          <Text style={styles.subtitle}>What's the issue?</Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.reasonsScroll}
            contentContainerStyle={styles.reasonsContent}
          >
            {REPORT_REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.reasonRow, selectedReason === r.value && styles.reasonRowSelected]}
                onPress={() => setSelectedReason(r.value)}
                activeOpacity={0.75}
              >
                <View style={[styles.radio, selectedReason === r.value && styles.radioSelected]}>
                  {selectedReason === r.value && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.reasonLabel, selectedReason === r.value && styles.reasonLabelSelected]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.detailsLabel}>Add details (optional)</Text>
            <TextInput
              style={styles.detailsInput}
              value={details}
              onChangeText={setDetails}
              placeholder="Describe the issue..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              numberOfLines={3}
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitBtn, (!selectedReason || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!selectedReason || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={colors.black} size="small" />
            ) : (
              <Text style={styles.submitText}>Submit Report</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '85%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray600,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  reasonsScroll: { flexGrow: 0 },
  reasonsContent: { gap: spacing.xs, paddingBottom: spacing.md },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  reasonRowSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(46,204,113,0.07)',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.gray500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  reasonLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  reasonLabelSelected: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
  detailsLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  detailsInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  submitBtn: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.base,
  },
});
