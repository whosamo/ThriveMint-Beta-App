import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import StepIndicator from '../../components/ui/StepIndicator';
import MultiSelectChips from '../../components/ui/MultiSelectChips';
import OptionPicker from '../../components/ui/OptionPicker';
import { borderRadius, colors, spacing, typography } from '../../theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL = 4;

const SERVICES = [
  'Video Production', 'Photography', 'Graphic Design', 'Social Media',
  'SEO', 'Web Dev', 'App Dev', 'Copywriting', 'Marketing Strategy', 'Paid Ads',
];

const AVAILABILITY_OPTIONS = ['Full-time', 'Part-time', 'Project-based'];
const RADIUS_OPTIONS = ['10 mi', '25 mi', '50 mi', '100 mi'];

const STEP_TITLES = [
  'Your Profile',
  'Your Services',
  'Location & Availability',
  'Profile Photo',
];

const AVAILABILITY_MAP: Record<string, string> = {
  'Full-time': 'full_time',
  'Part-time': 'part_time',
  'Project-based': 'contract',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Form {
  bio: string;
  hourlyRate: string;
  yearsExp: string;
  serviceCategories: string[];
  availability: string;
  radiusMiles: string;
  avatarUri: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  state: string | null;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function FreelancerOnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>({
    bio: '',
    hourlyRate: '',
    yearsExp: '',
    serviceCategories: [],
    availability: '',
    radiusMiles: '25 mi',
    avatarUri: null,
    lat: null,
    lng: null,
    city: null,
    state: null,
  });
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  const patch = <K extends keyof Form>(key: K, val: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const validate = (): boolean => {
    if (step === 1) {
      if (!form.bio.trim()) { Alert.alert('Required', 'Add a short bio.'); return false; }
      if (!form.hourlyRate || isNaN(Number(form.hourlyRate))) {
        Alert.alert('Required', 'Enter a valid hourly rate.'); return false;
      }
    }
    if (step === 2 && form.serviceCategories.length === 0) {
      Alert.alert('Required', 'Select at least one service.'); return false;
    }
    if (step === 3 && !form.availability) {
      Alert.alert('Required', 'Select your availability.'); return false;
    }
    return true;
  };

  const requestLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location skipped', 'You can continue without location.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [addr] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setForm((f) => ({
        ...f,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        city: addr.city ?? addr.subregion ?? null,
        state: addr.region ?? null,
      }));
    } catch {
      Alert.alert('Error', 'Could not get location.');
    } finally {
      setLocLoading(false);
    }
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to upload a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) patch('avatarUri', result.assets[0].uri);
  };

  const uploadAvatar = async (userId: string, uri: string): Promise<string | null> => {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      const ext = uri.split('.').pop() ?? 'jpg';
      const path = `${userId}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: `image/${ext}`, upsert: true });
      if (error) return null;
      return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    } catch {
      return null;
    }
  };

  const handleNext = async () => {
    if (!validate()) return;
    if (step < TOTAL) { setStep((s) => s + 1); return; }
    if (!user) return;

    setLoading(true);
    try {
      let avatarUrl: string | null = null;
      if (form.avatarUri) avatarUrl = await uploadAvatar(user.id, form.avatarUri);

      await supabase.from('users').update({
        lat: form.lat,
        lng: form.lng,
        city: form.city,
        state: form.state,
        radius_preference_miles: parseInt(form.radiusMiles, 10),
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      }).eq('id', user.id);

      const { error } = await supabase.from('freelancer_profiles').insert({
        user_id: user.id,
        bio: form.bio.trim(),
        hourly_rate: parseFloat(form.hourlyRate),
        years_experience: form.yearsExp ? parseInt(form.yearsExp, 10) : null,
        service_categories: form.serviceCategories,
        availability: AVAILABILITY_MAP[form.availability] ?? 'contract',
        verification_status: 'pending',
      });

      if (error) throw error;
      await refreshProfile();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.logo}>ThriveMint</Text>
          <Text style={styles.sub}>Set up your freelancer profile</Text>

          <StepIndicator current={step} total={TOTAL} title={STEP_TITLES[step - 1]} />

          {/* ── Step 1 ──────────────────────────────────── */}
          {step === 1 && (
            <View>
              <Input
                label="Bio"
                placeholder="Tell businesses what you do and what makes you stand out…"
                value={form.bio}
                onChangeText={(v) => patch('bio', v)}
                multiline
                numberOfLines={4}
                style={styles.bioInput}
              />
              <Input
                label="Hourly Rate (USD)"
                placeholder="e.g. 75"
                value={form.hourlyRate}
                onChangeText={(v) => patch('hourlyRate', v)}
                keyboardType="decimal-pad"
              />
              <Input
                label="Years of Experience"
                placeholder="e.g. 5"
                value={form.yearsExp}
                onChangeText={(v) => patch('yearsExp', v)}
                keyboardType="number-pad"
              />
            </View>
          )}

          {/* ── Step 2 ──────────────────────────────────── */}
          {step === 2 && (
            <View>
              <Text style={styles.fieldHint}>Select all that apply</Text>
              <MultiSelectChips
                options={SERVICES}
                selected={form.serviceCategories}
                onChange={(v) => patch('serviceCategories', v)}
              />
            </View>
          )}

          {/* ── Step 3 ──────────────────────────────────── */}
          {step === 3 && (
            <View>
              <Text style={styles.fieldLabel}>Your Location</Text>
              <TouchableOpacity
                style={[styles.locBtn, !!form.lat && styles.locBtnActive]}
                onPress={requestLocation}
                activeOpacity={0.8}
              >
                <Text style={styles.locIcon}>{form.lat ? '📍' : '🗺️'}</Text>
                <View style={styles.locText}>
                  <Text style={styles.locTitle}>
                    {form.lat ? 'Location set' : 'Use current location'}
                  </Text>
                  <Text style={styles.locSub}>
                    {form.city
                      ? `${form.city}${form.state ? `, ${form.state}` : ''}`
                      : 'Tap to enable'}
                  </Text>
                </View>
                {locLoading && <Text style={styles.locSpinner}>…</Text>}
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Travel Radius</Text>
              <OptionPicker
                options={RADIUS_OPTIONS}
                value={form.radiusMiles}
                onChange={(v) => patch('radiusMiles', v)}
                columns={4}
              />

              <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Availability</Text>
              <OptionPicker
                options={AVAILABILITY_OPTIONS}
                value={form.availability}
                onChange={(v) => patch('availability', v)}
                columns={3}
              />
            </View>
          )}

          {/* ── Step 4 ──────────────────────────────────── */}
          {step === 4 && (
            <View style={styles.photoStep}>
              <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
                {form.avatarUri ? (
                  <Image source={{ uri: form.avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.cameraIcon}>📷</Text>
                    <Text style={styles.photoHint}>Tap to choose photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              {form.avatarUri ? (
                <TouchableOpacity onPress={() => patch('avatarUri', null)}>
                  <Text style={styles.removePhoto}>Remove photo</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.skipHint}>
                You can skip this and add a photo later from your profile.
              </Text>
            </View>
          )}

          {/* ── Nav ─────────────────────────────────────── */}
          <View style={styles.nav}>
            {step > 1 && (
              <Button
                label="Back"
                variant="ghost"
                onPress={() => setStep((s) => s - 1)}
                style={styles.backBtn}
              />
            )}
            <Button
              label={step === TOTAL ? 'Complete Setup' : 'Continue'}
              onPress={handleNext}
              loading={loading}
              style={styles.nextBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  logo: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  sub: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  bioInput: { height: 120, textAlignVertical: 'top', paddingTop: spacing.sm },
  fieldLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  fieldHint: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  locBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  locBtnActive: { borderColor: colors.primary },
  locIcon: { fontSize: 28 },
  locText: { flex: 1 },
  locTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  locSub: { fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  locSpinner: { color: colors.primary },
  photoStep: { alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cameraIcon: { fontSize: 40 },
  photoHint: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  removePhoto: { fontSize: typography.fontSize.sm, color: colors.error },
  skipHint: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  nav: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },
});
