import React, { useState } from 'react';
import {
  Alert,
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

const INDUSTRIES = ['Creative', 'Marketing', 'Tech', 'Retail', 'Food & Bev', 'Health', 'Other'];

const SERVICES = [
  'Video Production', 'Photography', 'Graphic Design', 'Social Media',
  'SEO', 'Web Dev', 'App Dev', 'Copywriting', 'Marketing Strategy', 'Paid Ads',
];

const RADIUS_OPTIONS = ['10 mi', '25 mi', '50 mi', '100 mi'];

const BUDGET_OPTIONS = [
  'Under $500/mo', '$500–$2K/mo', '$2K–$5K/mo', '$5K–$10K/mo', '$10K+/mo',
];

const STEP_TITLES = [
  'Your Business',
  'What are you looking for?',
  'Your Location',
  'Budget Preference',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Form {
  businessName: string;
  industry: string;
  servicePreferences: string[];
  radiusMiles: string;
  budgetRange: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
  state: string | null;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BusinessOnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>({
    businessName: '',
    industry: '',
    servicePreferences: [],
    radiusMiles: '25 mi',
    budgetRange: '',
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
      if (!form.businessName.trim()) {
        Alert.alert('Required', 'Enter your business name.'); return false;
      }
      if (!form.industry) {
        Alert.alert('Required', 'Select an industry.'); return false;
      }
    }
    if (step === 2 && form.servicePreferences.length === 0) {
      Alert.alert('Required', 'Select at least one service.'); return false;
    }
    if (step === 4 && !form.budgetRange) {
      Alert.alert('Required', 'Select a budget range.'); return false;
    }
    return true;
  };

  const requestLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location skipped', 'You can still continue — location helps match nearby freelancers.');
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
      Alert.alert('Error', 'Could not get location. You can continue without it.');
    } finally {
      setLocLoading(false);
    }
  };

  const handleNext = async () => {
    if (!validate()) return;
    if (step < TOTAL) { setStep((s) => s + 1); return; }
    if (!user) return;

    setLoading(true);
    try {
      const radiusNum = parseInt(form.radiusMiles, 10);

      await supabase.from('users').update({
        lat: form.lat,
        lng: form.lng,
        city: form.city,
        state: form.state,
        radius_preference_miles: radiusNum,
      }).eq('id', user.id);

      const { error } = await supabase.from('business_profiles').insert({
        user_id: user.id,
        business_name: form.businessName.trim(),
        industry: form.industry,
        service_preferences: form.servicePreferences,
        budget_range: form.budgetRange,
      });

      if (error) throw error;
      await refreshProfile();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save. Please try again.');
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
          <Text style={styles.sub}>Set up your business profile</Text>

          <StepIndicator current={step} total={TOTAL} title={STEP_TITLES[step - 1]} />

          {/* ── Step 1 ──────────────────────────────────── */}
          {step === 1 && (
            <View>
              <Input
                label="Business Name"
                placeholder="Acme Creative Co."
                value={form.businessName}
                onChangeText={(v) => patch('businessName', v)}
              />
              <Text style={styles.fieldLabel}>Industry</Text>
              <OptionPicker
                options={INDUSTRIES}
                value={form.industry}
                onChange={(v) => patch('industry', v)}
                columns={3}
              />
            </View>
          )}

          {/* ── Step 2 ──────────────────────────────────── */}
          {step === 2 && (
            <View>
              <Text style={styles.fieldHint}>Select all that apply</Text>
              <MultiSelectChips
                options={SERVICES}
                selected={form.servicePreferences}
                onChange={(v) => patch('servicePreferences', v)}
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

              <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Search Radius</Text>
              <OptionPicker
                options={RADIUS_OPTIONS}
                value={form.radiusMiles}
                onChange={(v) => patch('radiusMiles', v)}
                columns={4}
              />
            </View>
          )}

          {/* ── Step 4 ──────────────────────────────────── */}
          {step === 4 && (
            <View>
              <Text style={styles.fieldHint}>
                This helps us match you with the right talent
              </Text>
              <OptionPicker
                options={BUDGET_OPTIONS}
                value={form.budgetRange}
                onChange={(v) => patch('budgetRange', v)}
                columns={2}
              />
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
  nav: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },
});
