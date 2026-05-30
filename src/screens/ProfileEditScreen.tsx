import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { colors, typography, spacing, borderRadius } from '../theme';
import { RESPONSE_TIME_LABELS } from '../types/availability';

const SERVICES = [
  'Video Production', 'Photography', 'Graphic Design', 'Social Media',
  'SEO', 'Web Dev', 'App Dev', 'Copywriting', 'Marketing Strategy', 'Paid Ads',
];

const AVAILABILITY_OPTIONS = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'unavailable', label: 'Unavailable' },
];

const RADIUS_OPTIONS = [
  { value: '10', label: '10 mi' },
  { value: '25', label: '25 mi' },
  { value: '50', label: '50 mi' },
  { value: '100', label: '100 mi' },
];

const RESPONSE_OPTIONS = Object.entries(RESPONSE_TIME_LABELS).map(([value, label]) => ({ value, label }));

interface FormState {
  fullName: string;
  bio: string;
  hourlyRate: string;
  yearsExp: string;
  serviceCategories: string[];
  availability: string;
  acceptingNewWork: boolean;
  typicalResponseTime: string;
  radiusMiles: string;
  avatarUri: string | null;
  avatarChanged: boolean;
}

export default function ProfileEditScreen() {
  const navigation = useNavigation();
  const { user, profile, refreshProfile } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    fullName: '',
    bio: '',
    hourlyRate: '',
    yearsExp: '',
    serviceCategories: [],
    availability: 'full_time',
    acceptingNewWork: true,
    typicalResponseTime: 'within_48_hours',
    radiusMiles: '25',
    avatarUri: null,
    avatarChanged: false,
  });

  useEffect(() => {
    async function load() {
      if (!user) return;
      const [fpRes] = await Promise.all([
        supabase
          .from('freelancer_profiles')
          .select('bio, hourly_rate, years_experience, service_categories, availability, accepting_new_work, typical_response_time')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const fp = fpRes.data as any;
      const avatarPublicUrl = profile?.avatar_url
        ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_url).data.publicUrl
        : null;

      setForm({
        fullName: profile?.full_name ?? '',
        bio: fp?.bio ?? '',
        hourlyRate: fp?.hourly_rate != null ? String(fp.hourly_rate) : '',
        yearsExp: fp?.years_experience != null ? String(fp.years_experience) : '',
        serviceCategories: fp?.service_categories ?? [],
        availability: fp?.availability ?? 'full_time',
        acceptingNewWork: fp?.accepting_new_work ?? true,
        typicalResponseTime: fp?.typical_response_time ?? 'within_48_hours',
        radiusMiles: String(profile?.radius_preference_miles ?? 25),
        avatarUri: avatarPublicUrl,
        avatarChanged: false,
      });
      setIsLoading(false);
    }
    load();
  }, [user, profile]);

  const toggleCategory = useCallback((cat: string) => {
    setForm((f) => ({
      ...f,
      serviceCategories: f.serviceCategories.includes(cat)
        ? f.serviceCategories.filter((c) => c !== cat)
        : [...f.serviceCategories, cat],
    }));
  }, []);

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setForm((f) => ({ ...f, avatarUri: result.assets[0].uri, avatarChanged: true }));
    }
  }

  async function save() {
    if (!user) return;
    setIsSaving(true);
    try {
      let avatarStoragePath: string | undefined;

      if (form.avatarChanged && form.avatarUri) {
        const resp = await fetch(form.avatarUri);
        const blob = await resp.blob();
        const buf = await blob.arrayBuffer();
        const path = `${user.id}/avatar.jpg`;
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, buf, { contentType: 'image/jpeg', upsert: true });
        if (upErr) throw upErr;
        avatarStoragePath = path;
      }

      // Update users table
      const userUpdate: Record<string, any> = {
        full_name: form.fullName.trim(),
        radius_preference_miles: parseInt(form.radiusMiles, 10) || 25,
      };
      if (avatarStoragePath) userUpdate.avatar_url = avatarStoragePath;
      const { error: userErr } = await supabase
        .from('users')
        .update(userUpdate)
        .eq('id', user.id);
      if (userErr) throw userErr;

      // Update freelancer_profiles
      const { error: fpErr } = await supabase
        .from('freelancer_profiles')
        .update({
          bio: form.bio.trim() || null,
          hourly_rate: form.hourlyRate ? parseFloat(form.hourlyRate) : null,
          years_experience: form.yearsExp ? parseInt(form.yearsExp, 10) : null,
          service_categories: form.serviceCategories,
          availability: form.availability,
          accepting_new_work: form.acceptingNewWork,
          typical_response_time: form.typicalResponseTime,
        })
        .eq('user_id', user.id);
      if (fpErr) throw fpErr;

      await refreshProfile();
      Alert.alert('Saved!', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Save failed', err.message ?? 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={save} disabled={isSaving} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}>
            {isSaving ? 'Saving…' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Avatar */}
        <TouchableOpacity style={styles.avatarContainer} onPress={pickAvatar} activeOpacity={0.8}>
          {form.avatarUri ? (
            <Image source={{ uri: form.avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{form.fullName.charAt(0).toUpperCase() || '?'}</Text>
            </View>
          )}
          <View style={styles.avatarOverlay}>
            <Text style={styles.avatarOverlayText}>Edit</Text>
          </View>
        </TouchableOpacity>

        {/* Full name */}
        <Text style={styles.fieldLabel}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={form.fullName}
          onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))}
          placeholder="Your full name"
          placeholderTextColor={colors.textMuted}
        />

        {/* Bio */}
        <Text style={styles.fieldLabel}>Bio</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={form.bio}
          onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
          placeholder="Tell businesses what you do and what makes you unique"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          maxLength={500}
        />
        <Text style={styles.charCount}>{form.bio.length}/500</Text>

        {/* Hourly rate */}
        <Text style={styles.fieldLabel}>Hourly Rate ($)</Text>
        <TextInput
          style={styles.input}
          value={form.hourlyRate}
          onChangeText={(v) => setForm((f) => ({ ...f, hourlyRate: v.replace(/[^0-9.]/g, '') }))}
          placeholder="e.g. 75"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
        />

        {/* Years experience */}
        <Text style={styles.fieldLabel}>Years of Experience</Text>
        <TextInput
          style={styles.input}
          value={form.yearsExp}
          onChangeText={(v) => setForm((f) => ({ ...f, yearsExp: v.replace(/[^0-9]/g, '') }))}
          placeholder="e.g. 4"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
        />

        {/* Service categories */}
        <Text style={styles.fieldLabel}>Services</Text>
        <View style={styles.chipsWrap}>
          {SERVICES.map((cat) => {
            const active = form.serviceCategories.includes(cat);
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleCategory(cat)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Availability */}
        <Text style={styles.fieldLabel}>Availability</Text>
        <View style={styles.optionRow}>
          {AVAILABILITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionBtn, form.availability === opt.value && styles.optionBtnActive]}
              onPress={() => setForm((f) => ({ ...f, availability: opt.value }))}
              activeOpacity={0.75}
            >
              <Text style={[styles.optionText, form.availability === opt.value && styles.optionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Accepting new work toggle */}
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Accepting New Work</Text>
            <Text style={styles.toggleSub}>Shown as "Open to work" on your profile</Text>
          </View>
          <Switch
            value={form.acceptingNewWork}
            onValueChange={(v) => setForm((f) => ({ ...f, acceptingNewWork: v }))}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        {/* Typical response time */}
        <Text style={styles.fieldLabel}>Typical Response Time</Text>
        <View style={styles.optionRow}>
          {RESPONSE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionBtn, form.typicalResponseTime === opt.value && styles.optionBtnActive]}
              onPress={() => setForm((f) => ({ ...f, typicalResponseTime: opt.value }))}
              activeOpacity={0.75}
            >
              <Text style={[styles.optionText, form.typicalResponseTime === opt.value && styles.optionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search radius */}
        <Text style={styles.fieldLabel}>Search Radius</Text>
        <View style={styles.optionRow}>
          {RADIUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionBtn, form.radiusMiles === opt.value && styles.optionBtnActive]}
              onPress={() => setForm((f) => ({ ...f, radiusMiles: opt.value }))}
              activeOpacity={0.75}
            >
              <Text style={[styles.optionText, form.radiusMiles === opt.value && styles.optionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, isSaving && styles.submitBtnDisabled]}
          onPress={save}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>{isSaving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    color: colors.textSecondary,
    fontSize: 18,
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  saveBtn: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  saveBtnDisabled: { opacity: 0.5 },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.white,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  avatarOverlayText: {
    color: colors.black,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputMulti: {
    height: 100,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  chip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(46,204,113,0.12)',
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  optionBtn: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  optionBtnActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(46,204,113,0.12)',
  },
  optionText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  toggleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  toggleSub: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: {
    color: colors.black,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
