import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { borderRadius, colors, spacing, typography } from '../../theme';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
};

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* Logo */}
      <View style={styles.heroSection}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>TM</Text>
        </View>
        <Text style={styles.wordmark}>ThriveMint</Text>
        <Text style={styles.tagline}>Local talent. Real connections.</Text>
      </View>

      {/* CTAs */}
      <View style={styles.ctaSection}>
        <TouchableOpacity
          style={styles.primaryCta}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('SignUp', { role: 'business' })}
        >
          <Text style={styles.primaryCtaLabel}>I'm a Business</Text>
          <Text style={styles.primaryCtaSub}>Find local creative talent</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryCta}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('SignUp', { role: 'freelancer' })}
        >
          <Text style={styles.secondaryCtaLabel}>I'm a Freelancer / Agency</Text>
          <Text style={styles.secondaryCtaSub}>Showcase your work & get hired</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginLinkText}>
            Already have an account?{'  '}
            <Text style={styles.loginLinkBold}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoMarkText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.background,
    letterSpacing: -1,
  },
  wordmark: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.textPrimary,
    letterSpacing: -1.5,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  ctaSection: { gap: spacing.md },
  primaryCta: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  primaryCtaLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.background,
  },
  primaryCtaSub: {
    fontSize: typography.fontSize.sm,
    color: colors.background + 'BB',
    marginTop: spacing.xs,
  },
  secondaryCta: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryCtaLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  secondaryCtaSub: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  loginLink: { alignItems: 'center', paddingVertical: spacing.sm },
  loginLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  loginLinkBold: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
});
