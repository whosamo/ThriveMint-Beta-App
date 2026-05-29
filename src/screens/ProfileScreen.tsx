import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, typography, spacing, borderRadius } from '../theme';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavProp>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Manage your account and settings.</Text>

      <TouchableOpacity
        style={styles.menuRow}
        onPress={() => navigation.navigate('SavedBriefs')}
        activeOpacity={0.75}
      >
        <Text style={styles.menuIcon}>📋</Text>
        <View style={styles.menuText}>
          <Text style={styles.menuLabel}>Saved Briefs</Text>
          <Text style={styles.menuSub}>Your past AI-generated project briefs</Text>
        </View>
        <Text style={styles.menuChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuRow}
        onPress={() => navigation.navigate('BriefGenerator')}
        activeOpacity={0.75}
      >
        <Text style={styles.menuIcon}>✦</Text>
        <View style={styles.menuText}>
          <Text style={styles.menuLabel}>New Brief</Text>
          <Text style={styles.menuSub}>Describe a project and get an AI brief</Text>
        </View>
        <Text style={styles.menuChevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: 64,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  menuIcon: {
    fontSize: 22,
    marginRight: spacing.md,
  },
  menuText: { flex: 1 },
  menuLabel: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2,
  },
  menuSub: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
  },
  menuChevron: {
    color: colors.textMuted,
    fontSize: 22,
    marginLeft: spacing.sm,
  },
});
