import React, { useRef, useState } from 'react';
import {
  Animated,
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { generateBrief } from '../services/briefService';
import { BriefInput } from '../types/brief';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, typography, spacing, borderRadius } from '../theme';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const LOCATION_OPTIONS: Array<{ label: string; value: BriefInput['location_preference'] }> = [
  { label: 'Local only', value: 'local_only' },
  { label: 'Open to remote', value: 'open_to_remote' },
];

function GeneratingOverlay() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);

  return (
    <View style={overlay.container}>
      <Animated.View style={[overlay.card, { opacity }]}>
        <Text style={overlay.emoji}>✦</Text>
        <Text style={overlay.title}>Claude is scoping your project...</Text>
        <Text style={overlay.subtitle}>Generating a structured brief tailored to your needs.</Text>
        <View style={overlay.skeletonRow}>
          <View style={[overlay.skeleton, { width: '60%' }]} />
        </View>
        <View style={overlay.skeletonRow}>
          <View style={[overlay.skeleton, { width: '90%' }]} />
        </View>
        <View style={overlay.skeletonRow}>
          <View style={[overlay.skeleton, { width: '75%' }]} />
        </View>
        <View style={[overlay.skeletonRow, { marginTop: spacing.sm }]}>
          <View style={[overlay.skeleton, { width: 100, height: 8, borderRadius: borderRadius.full }]} />
          <View style={[overlay.skeleton, { width: 80, height: 8, borderRadius: borderRadius.full, marginLeft: spacing.sm }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const overlay = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,13,13,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emoji: { fontSize: 36, marginBottom: spacing.md },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  skeletonRow: {
    width: '100%',
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  skeleton: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
  },
});

export default function BriefGeneratorScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();

  const [description, setDescription] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [timeline, setTimeline] = useState('');
  const [locationPref, setLocationPref] = useState<BriefInput['location_preference']>(undefined);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = description.trim().length >= 10 && !generating;

  async function handleGenerate() {
    if (!canGenerate) return;
    setError(null);
    setGenerating(true);
    try {
      const input: BriefInput = {
        description: description.trim(),
        budget_range: budgetRange.trim() || undefined,
        timeline: timeline.trim() || undefined,
        location_preference: locationPref,
      };
      const brief = await generateBrief(input);
      navigation.replace('BriefResult', { brief });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {generating && <GeneratingOverlay />}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>What do you need?</Text>
          <Text style={styles.subheading}>
            Describe your project in plain language — Claude will turn it into a structured brief.
          </Text>

          {/* Main input */}
          <View style={styles.inputCard}>
            <TextInput
              style={styles.descInput}
              placeholder="e.g. I need someone to shoot and edit a 60-second promo video for my coffee shop's grand opening next month..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
              maxLength={2000}
            />
            <Text style={styles.charCount}>{description.length}/2000</Text>
          </View>

          {/* Optional fields */}
          <TouchableOpacity
            style={styles.optionsToggle}
            onPress={() => setOptionsOpen(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.optionsToggleText}>
              {optionsOpen ? '▾ Hide optional details' : '▸ Add optional details (budget, timeline, location)'}
            </Text>
          </TouchableOpacity>

          {optionsOpen && (
            <View style={styles.optionsContainer}>
              <Text style={styles.fieldLabel}>Budget range</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. $500–$1,500"
                placeholderTextColor={colors.textMuted}
                value={budgetRange}
                onChangeText={setBudgetRange}
              />

              <Text style={styles.fieldLabel}>Timeline</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. 2–3 weeks"
                placeholderTextColor={colors.textMuted}
                value={timeline}
                onChangeText={setTimeline}
              />

              <Text style={styles.fieldLabel}>Location preference</Text>
              <View style={styles.segmentRow}>
                {LOCATION_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.segmentBtn,
                      locationPref === opt.value && styles.segmentBtnActive,
                    ]}
                    onPress={() => setLocationPref(prev => (prev === opt.value ? undefined : opt.value))}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        locationPref === opt.value && styles.segmentTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={!canGenerate}
            activeOpacity={0.8}
          >
            <Text style={styles.generateBtnText}>✦ Generate Brief</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
  },
  backBtn: {
    marginBottom: spacing.lg,
  },
  backText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  heading: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.extrabold,
    marginBottom: spacing.sm,
  },
  subheading: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * 1.6,
    marginBottom: spacing.xl,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  descInput: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.6,
    minHeight: 160,
  },
  charCount: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  optionsToggle: {
    marginBottom: spacing.md,
  },
  optionsToggleText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  optionsContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  fieldInput: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderColor: colors.primary,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  segmentTextActive: {
    color: colors.primary,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  generateBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  generateBtnDisabled: {
    opacity: 0.45,
  },
  generateBtnText: {
    color: colors.black,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
