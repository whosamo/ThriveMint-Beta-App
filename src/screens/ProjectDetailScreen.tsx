import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getProjectWithMilestones, getContractByProject } from '../services/contractService';
import { Contract, ProjectWithMilestones } from '../types/contract';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

type RouteT = RouteProp<RootStackParamList, 'ProjectDetail'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_COLOR: Record<string, string> = {
  pending: colors.warning,
  active: colors.primary,
  completed: colors.info,
  disputed: colors.error,
};

export default function ProjectDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteT>();
  const { projectId, conversationId } = route.params;

  const [project, setProject] = useState<ProjectWithMilestones | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [proj, cont] = await Promise.all([
          getProjectWithMilestones(projectId),
          getContractByProject(projectId),
        ]);
        setProject(proj);
        setContract(cont);
      } catch {
        Alert.alert('Error', 'Failed to load project.');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const handleViewContract = useCallback(() => {
    if (!contract) return;
    navigation.navigate('ContractReview', {
      contractId: contract.id,
      conversationId,
    });
  }, [contract, conversationId, navigation]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Project not found.</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLOR[project.status] ?? colors.textMuted;
  const totalPaid = project.milestones
    .filter((m) => m.status === 'released')
    .reduce((sum, m) => sum + m.amount, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {project.title}
        </Text>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>${project.total_amount.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Total Value</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>${totalPaid.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Paid</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{project.milestones.length}</Text>
              <Text style={styles.summaryLabel}>Milestones</Text>
            </View>
          </View>
        </View>

        {!!project.description && (
          <>
            <Text style={styles.sectionLabel}>Description</Text>
            <View style={styles.textBlock}>
              <Text style={styles.bodyText}>{project.description}</Text>
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>Milestones</Text>
        {project.milestones.length === 0 ? (
          <View style={styles.textBlock}>
            <Text style={styles.bodyText}>No milestones yet.</Text>
          </View>
        ) : (
          project.milestones.map((m) => (
            <View key={m.id} style={styles.milestoneRow}>
              <View
                style={[
                  styles.milestoneDot,
                  m.status === 'released' && styles.milestoneDotDone,
                ]}
              />
              <View style={styles.milestoneContent}>
                <Text style={styles.milestoneTitle}>{m.title}</Text>
                {m.due_date && (
                  <Text style={styles.milestoneDue}>
                    Due {new Date(m.due_date).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.milestoneAmount,
                  m.status === 'released' && styles.milestoneAmountDone,
                ]}
              >
                ${m.amount.toLocaleString()}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.sectionLabel}>Contract</Text>
        {contract ? (
          <TouchableOpacity
            style={styles.contractCard}
            onPress={handleViewContract}
            activeOpacity={0.8}
          >
            <View style={styles.contractCardTop}>
              <Text style={styles.contractCardIcon}>📄</Text>
              <View style={styles.contractCardInfo}>
                <Text style={styles.contractCardTitle}>Scope of Work Agreement</Text>
                <Text style={styles.contractCardSub} numberOfLines={2}>
                  {contract.scope_text}
                </Text>
              </View>
            </View>
            <View style={styles.contractCardBottom}>
              <View
                style={[
                  styles.contractStatusBadge,
                  contract.status === 'active' && styles.contractStatusActive,
                ]}
              >
                <Text
                  style={[
                    styles.contractStatusText,
                    contract.status === 'active' && styles.contractStatusTextActive,
                  ]}
                >
                  {contract.status === 'active'
                    ? '✓ Active'
                    : contract.status === 'pending_signature'
                    ? '⏳ Pending Signature'
                    : 'Draft'}
                </Text>
              </View>
              <Text style={styles.viewContractLink}>View →</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.noContractCard}>
            <Text style={styles.noContractText}>No contract generated yet.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: colors.error, fontSize: typography.fontSize.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 56,
  },
  backIcon: { color: colors.textPrimary, fontSize: 22, marginRight: spacing.md },
  headerTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  statusBadge: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  summaryLabel: { color: colors.textSecondary, fontSize: typography.fontSize.xs, marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: colors.border },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  textBlock: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  bodyText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  milestoneDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gray600,
    marginRight: spacing.md,
  },
  milestoneDotDone: { backgroundColor: colors.primary },
  milestoneContent: { flex: 1 },
  milestoneTitle: { color: colors.textPrimary, fontSize: typography.fontSize.base },
  milestoneDue: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  milestoneAmount: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  milestoneAmountDone: { color: colors.primary },
  contractCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  contractCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  contractCardIcon: { fontSize: 24, marginRight: spacing.md },
  contractCardInfo: { flex: 1 },
  contractCardTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 4,
  },
  contractCardSub: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  contractCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contractStatusBadge: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  contractStatusActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(46,204,113,0.12)',
  },
  contractStatusText: {
    color: colors.warning,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  contractStatusTextActive: { color: colors.primary },
  viewContractLink: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  noContractCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  noContractText: { color: colors.textMuted, fontSize: typography.fontSize.sm },
});
