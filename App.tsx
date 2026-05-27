import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import { colors, typography, spacing } from './src/theme';

function SplashScreen() {
  return (
    <View style={styles.splashContainer}>
      <StatusBar style="light" />
      <Text style={styles.logo}>ThriveMint</Text>
      <Text style={styles.tagline}>Grow. Thrive. Mint.</Text>
      <ActivityIndicator
        color={colors.primary}
        size="small"
        style={styles.loader}
      />
    </View>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Simulate initialization (auth check, asset loading, etc.)
    const timer = setTimeout(() => setIsReady(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Navigation />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logo: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
    letterSpacing: -1,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xxl,
  },
  loader: {
    marginTop: spacing.lg,
  },
});
