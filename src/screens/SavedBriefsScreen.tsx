import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSavedBriefs, deleteBrief } from '../services/briefService';
import { supabase } from '../services/supabase';
import { Brief } from '../types/brief';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, typography, spacing, borderRadius } from '../theme';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function BriefRow({ brief, onPress, onDelete }: { brief: Brief; onPress: () => void; onDelete: () => void }) {
  const dateStr = new Date(brief.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  function confirmDelete() {
    Alert.alert('Delete Brief', 'Remove this brief permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  }

  return (
    <TouchableOpacity style={styles.briefRow} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.briefRowInner}>
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{brief.service_category}</Text>
            </View>
            <Text style={styles.dateText}>{dateStr}</Text>
          </View>
          <Text style={styles.briefTitle} numberOfLines={1}>{brief.title}</Text>
          <Text style={styles.briefSummary} numberOfLines={2}>{brief.summary}</Text>
          {(brief.timeline || brief.budget_range) && (
            <View style={styles.metaRow}>
              {brief.timeline ? (
                <Text style={styles.metaTag}>⏱ {brief.timeline}</Text>
              ) : null}
              {brief.budget_range ? (
                <Text style={styles.metaTag}>💰 {brief.budget_range}</Text>
              ) : null}
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.deleteIconBtn} onPress={confirmDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.deleteIconText}>✕</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function SavedBriefsScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadBriefs() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await getSavedBriefs(user.id);
      setBriefs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load briefs');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { loadBriefs(); }, []));

  async function handleDelete(briefId: string) {
    try {
      await deleteBrief(briefId);
      setBriefs(prev => prev.filter(b => b.id !== briefId));
    } catch {
      Alert.alert('Error', 'Failed to delete brief.');
    }
  }

  function handleOpen(brief: Brief) {
    navigation.navigate('BriefResult', {
      brief: {
        title: brief.title,
        summary: brief.summary,
        service_category: brief.service_category,
        deliverables: brief.deliverables,
        estimated_timeline: brief.timeline ?? '',
        suggested_budget_range: brief.budget_range ?? '',
        ideal_freelancer_profile: brief.ideal_freelancer_profile ?? '',
      },
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Saved Briefs</Text>
        <TouchableOpacity onPress={() => navigation.navigate('BriefGenerator')}>
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.mutedText}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadBriefs} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : briefs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No briefs yet</Text>
          <Text style={styles.emptySubtitle}>Generate your first project brief to get started.</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('BriefGenerator')}>
            <Text style={styles.createBtnText}>Create a Brief</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={briefs}
          keyExtractor={b => b.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          renderItem={({ item }) => (
            <BriefRow
              brief={item}
              onPress={() => handleOpen(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  heading: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  newBtnText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  mutedText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.base,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: colors.black,
    fontWeight: typography.fontWeight.bold,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  createBtnText: {
    color: colors.black,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },
  briefRow: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  briefRowInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  categoryChip: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  categoryChipText: {
    color: colors.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  briefTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4,
  },
  briefSummary: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * 1.5,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  metaTag: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  deleteIconBtn: {
    paddingLeft: spacing.md,
    paddingTop: 2,
  },
  deleteIconText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
