import React, { useCallback, useState } from 'react';
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
import { MilestoneDraft, ProjectDraft } from '../../types/messaging';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (draft: ProjectDraft) => Promise<void>;
}

const EMPTY_MILESTONE: MilestoneDraft = { title: '', amount: '', due_date: '' };

export default function ProjectModal({ visible, onClose, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([{ ...EMPTY_MILESTONE }]);
  const [loading, setLoading] = useState(false);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setTotalAmount('');
    setMilestones([{ ...EMPTY_MILESTONE }]);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const updateMilestone = useCallback(
    (index: number, field: keyof MilestoneDraft, value: string) => {
      setMilestones((prev) =>
        prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
      );
    },
    [],
  );

  const addMilestone = useCallback(() => {
    setMilestones((prev) => [...prev, { ...EMPTY_MILESTONE }]);
  }, []);

  const removeMilestone = useCallback((index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a project title.');
      return;
    }
    if (!totalAmount.trim() || isNaN(parseFloat(totalAmount))) {
      Alert.alert('Required', 'Please enter a valid total amount.');
      return;
    }
    for (const [i, m] of milestones.entries()) {
      if (!m.title.trim()) {
        Alert.alert('Required', `Please enter a title for milestone ${i + 1}.`);
        return;
      }
      if (!m.amount.trim() || isNaN(parseFloat(m.amount))) {
        Alert.alert('Required', `Please enter a valid amount for milestone ${i + 1}.`);
        return;
      }
    }

    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        total_amount: totalAmount.trim(),
        milestones,
      });
      resetForm();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not create project. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [title, description, totalAmount, milestones, onSubmit, resetForm, onClose]);

  const milestoneAmountSum = milestones.reduce((sum, m) => {
    const v = parseFloat(m.amount);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const total = parseFloat(totalAmount);
  const amountMismatch =
    !isNaN(total) && milestones.length > 0 && Math.abs(milestoneAmountSum - total) > 0.01;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Create Project</Text>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.sectionLabel}>PROJECT DETAILS</Text>

          <TextInput
            style={styles.input}
            placeholder="Project title *"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={1000}
          />

          <TextInput
            style={styles.input}
            placeholder="Total budget ($) *"
            placeholderTextColor={colors.textMuted}
            value={totalAmount}
            onChangeText={setTotalAmount}
            keyboardType="decimal-pad"
            maxLength={12}
          />

          <Text style={styles.sectionLabel}>MILESTONES</Text>

          {milestones.map((m, i) => (
            <View key={i} style={styles.milestoneCard}>
              <View style={styles.milestoneHeader}>
                <Text style={styles.milestoneNum}>Milestone {i + 1}</Text>
                {milestones.length > 1 && (
                  <TouchableOpacity onPress={() => removeMilestone(i)}>
                    <Text style={styles.removeBtn}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={styles.milestoneInput}
                placeholder="Title *"
                placeholderTextColor={colors.textMuted}
                value={m.title}
                onChangeText={(v) => updateMilestone(i, 'title', v)}
                maxLength={120}
              />
              <TextInput
                style={styles.milestoneInput}
                placeholder="Amount ($) *"
                placeholderTextColor={colors.textMuted}
                value={m.amount}
                onChangeText={(v) => updateMilestone(i, 'amount', v)}
                keyboardType="decimal-pad"
                maxLength={12}
              />
              <TextInput
                style={styles.milestoneInput}
                placeholder="Due date (YYYY-MM-DD, optional)"
                placeholderTextColor={colors.textMuted}
                value={m.due_date}
                onChangeText={(v) => updateMilestone(i, 'due_date', v)}
                maxLength={10}
              />
            </View>
          ))}

          {amountMismatch && (
            <Text style={styles.mismatchWarning}>
              ⚠ Milestone amounts (${milestoneAmountSum.toFixed(2)}) don't match total (${parseFloat(totalAmount).toFixed(2)})
            </Text>
          )}

          <TouchableOpacity style={styles.addMilestoneBtn} onPress={addMilestone}>
            <Text style={styles.addMilestoneBtnText}>+ Add Milestone</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.black} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Send Project Proposal</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.gray700,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  closeBtn: {
    color: colors.textSecondary,
    fontSize: 18,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  textArea: {
    minHeight: 88,
    paddingTop: spacing.sm + 2,
  },
  milestoneCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  milestoneNum: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  removeBtn: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
  },
  milestoneInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  mismatchWarning: {
    color: colors.warning,
    fontSize: typography.fontSize.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  addMilestoneBtn: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  addMilestoneBtnText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  submitBtn: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.black,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
