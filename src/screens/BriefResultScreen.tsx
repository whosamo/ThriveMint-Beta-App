import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { saveBrief } from '../services/briefService';
import { supabase } from '../services/supabase';
import { useBriefContext } from '../context/BriefContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'BriefResult'>;

export default function BriefResultScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { setActiveBriefMatch } = useBriefContext();

  const initial = route.params.brief;

  const [title, setTitle] = useState(initial.title);
  const [summary] = useState(initial.summary);
  const [deliverables, setDeliverables] = useState<string[]>(initial.deliverables);
  const [newDeliverable, setNewDeliverable] = useState('');
  const [timeline, setTimeline] = useState(initial.estimated_timeline);
  const [budgetRange, setBudgetRange] = useState(initial.suggested_budget_range);
  const [idealProfile] = useState(initial.ideal_freelancer_profile);
  const [saving, setSaving] = useState(false);

  function updateDeliverable(index: number, value: string) {
    setDeliverables(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function removeDeliverable(index: number) {
    setDeliverables(prev => prev.filter((_, i) => i !== index));
  }

  function addDeliverable() {
    const trimmed = newDeliverable.trim();
    if (!trimmed) return;
    setDeliverables(prev => [...prev, trimmed]);
    setNewDeliverable('');
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      await saveBrief(
        {
          ...initial,
          title,
          deliverables,
          estimated_timeline: timeline,
          suggested_budget_range: budgetRange,
        },
        user.id,
      );
      Alert.alert('Saved!', 'Your brief has been saved to your profile.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save brief.');
    } finally {
      setSaving(false);
    }
  }

  function handleFindFreelancers() {
    setActiveBriefMatch({
      service_category: initial.service_category,
      ideal_freelancer_profile: idealProfile,
      brief_title: title,
    });
    navigation.navigate('Main');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Edit</Text>
          </TouchableOpacity>
          <Text style={styles.headerLabel}>✦ AI Brief</Text>
        </View>

        {/* Title */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Project Title</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Project title"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Service category */}
        <View style={[styles.categoryBadge]}>
          <Text style={styles.categoryText}>{initial.service_category}</Text>
        </View>

        {/* Summary */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Summary</Text>
          <Text style={styles.bodyText}>{summary}</Text>
        </View>

        {/* Deliverables */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Deliverables</Text>
          {deliverables.map((item, idx) => (
            <View key={idx} style={styles.deliverableRow}>
              <Text style={styles.checkmark}>◻</Text>
              <TextInput
                style={styles.deliverableInput}
                value={item}
                onChangeText={v => updateDeliverable(idx, v)}
                multiline
              />
              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeDeliverable(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add new deliverable */}
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder="Add a deliverable..."
              placeholderTextColor={colors.textMuted}
              value={newDeliverable}
              onChangeText={setNewDeliverable}
              onSubmitEditing={addDeliverable}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addDeliverable} disabled={!newDeliverable.trim()}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Timeline + Budget */}
        <View style={styles.twoColRow}>
          <View style={[styles.card, { flex: 1, marginRight: spacing.sm / 2 }]}>
            <Text style={styles.sectionLabel}>Timeline</Text>
            <TextInput
              style={styles.inlineInput}
              value={timeline}
              onChangeText={setTimeline}
              placeholder="e.g. 2 weeks"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={[styles.card, { flex: 1, marginLeft: spacing.sm / 2 }]}>
            <Text style={styles.sectionLabel}>Budget Range</Text>
            <TextInput
              style={styles.inlineInput}
              value={budgetRange}
              onChangeText={setBudgetRange}
              placeholder="e.g. $500–$1,500"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {/* Ideal freelancer */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Ideal Freelancer Profile</Text>
          <Text style={styles.bodyText}>{idealProfile}</Text>
        </View>
      </ScrollView>

      {/* Sticky CTAs */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity style={styles.findBtn} onPress={handleFindFreelancers} activeOpacity={0.85}>
          <Text style={styles.findBtnText}>Find Matching Freelancers →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Brief'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  headerLabel: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  titleInput: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  categoryText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  bodyText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.6,
  },
  deliverableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  checkmark: {
    color: colors.primary,
    fontSize: 16,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  deliverableInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.5,
  },
  deleteBtn: {
    paddingLeft: spacing.sm,
    paddingTop: 2,
  },
  deleteBtnText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  addInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: colors.black,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: typography.fontWeight.bold,
  },
  twoColRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  inlineInput: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
  },
  ctaBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    ...shadows.md,
  },
  findBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  findBtnText: {
    color: colors.black,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  saveBtn: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
