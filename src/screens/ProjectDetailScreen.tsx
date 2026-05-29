import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { supabase } from '../services/supabase';
import { RootStackParamList } from '../navigation/RootNavigator';
import MilestoneReleaseConfirmModal from '../components/projects/MilestoneReleaseConfirmModal';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

type RouteT = RouteProp<RootStackParamList, 'ProjectDetail'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_COLOR: Record<string, string> = {
  pending: colors.warning,
  active: colors.primary,
  completed: colors.info,
  disputed: colors.error,
};

interface FreelancerInfo {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
}

export default function ProjectDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteT>();
  const { projectId, conversationId } = route.params;

  const [project, setProject] = useState<ProjectWithMilestones | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [freelancer, setFreelancer] = useState<FreelancerInfo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Milestone release modal state
  const [releaseTarget, setReleaseTarget] = useState<{
    milestoneId: string;
    title: string;
    amount: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id ?? null);

        const [proj, cont] = await Promise.all([
          getProjectWithMilestones(projectId),
          getContractByProject(projectId),
        ]);
        setProject(proj);
        setContract(cont);

        // Fetch freelancer info
        const { data: u } = await supabase
          .from('users')
          .select('id, full_name, avatar_url')
          .eq('id', proj.freelancer_user_id)
          .single();

        if (u) {
          setFreelancer({ userId: u.id, fullName: u.full_name, avatarUrl: u.avatar_url });
        }
      } catch {
        Alert.alert('Error', 'Failed to load project.');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const isBusiness = project != null && currentUserId === project.business_user_id;

  const handleViewContract = useCallback(() => {
    if (!contract) return;
    navigation.navigate('ContractReview', { contractId: contract.id, conversationId });
  }, [contract, conversationId, navigation]);

  const handleChat = useCallback(() => {
    if (!freelancer) return;
    navigation.navigate('Chat', {
      conversationId,
      otherUserId: freelancer.userId,
      otherUserName: freelancer.fullName,
      otherUserAvatar: freelancer.avatarUrl,
    });
  }, [freelancer, conversationId, navigation]);

  const handleReleaseMilestone = useCallback(
    async (milestoneId: string) => {
      setActionLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('release-milestone', {
          body: { milestone_id: milestoneId, conversation_id: conversationId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Reload project state
        const updated = await getProjectWithMilestones(projectId);
        setProject(updated);
        setReleaseTarget(null);
        Alert.alert('Released!', 'Milestone payment has been released to the freelancer.');
      } catch (err: any) {
        Alert.alert('Failed', err.message ?? 'Could not release milestone. Please try again.');
        setReleaseTarget(null);
      } finally {
        setActionLoading(false);
      }
    },
    [projectId, conversationId],
  );

  const handleRequestRevision = useCallback(async () => {
    if (!project || !currentUserId || !conversationId) return;
    setActionLoading(true);
    try {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        message_type: 'system',
        content: `📝 A revision has been requested on "${project.title}". Please review and update the deliverables.`,
      });
      Alert.alert('Sent', 'Revision request sent to the freelancer.');
    } catch {
      Alert.alert('Error', 'Failed to send revision request.');
    } finally {
      setActionLoading(false);
    }
  }, [project, currentUserId, conversationId]);

  const handleFlagDispute = useCallback(() => {
    if (!project || !currentUserId) return;
    Alert.alert(
      'Flag Dispute',
      'Are you sure you want to flag this project as disputed? Our team will be notified and will reach out within 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Flag Dispute',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await supabase.from('projects').update({ status: 'disputed' }).eq('id', project.id);

              // Insert admin alert using service-level table access
              await supabase.from('admin_alerts').insert({
                type: 'dispute_flagged',
                payload: {
                  project_id: project.id,
                  project_title: project.title,
                  flagged_by: currentUserId,
                  freelancer_user_id: project.freelancer_user_id,
                },
              });

              // System message in conversation
              if (conversationId) {
                await supabase.from('messages').insert({
                  conversation_id: conversationId,
                  sender_id: currentUserId,
                  message_type: 'system',
                  content: `⚠️ This project has been flagged as disputed. ThriveMint support has been notified and will reach out within 24 hours.`,
                });
              }

              setProject((prev) => prev ? { ...prev, status: 'disputed' } : prev);
              Alert.alert('Dispute Flagged', 'Our support team has been notified and will reach out soon.');
            } catch {
              Alert.alert('Error', 'Failed to flag dispute. Please contact support.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [project, currentUserId, conversationId]);

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
  const pendingMilestones = project.milestones.filter((m) => m.status === 'pending');

  const freelancerAvatarUrl = freelancer?.avatarUrl
    ? supabase.storage.from('avatars').getPublicUrl(freelancer.avatarUrl).data.publicUrl
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{project.title}</Text>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Freelancer row + chat shortcut */}
        {freelancer && (
          <View style={styles.freelancerRow}>
            {freelancerAvatarUrl ? (
              <Image source={{ uri: freelancerAvatarUrl }} style={styles.fAvatar} />
            ) : (
              <View style={styles.fAvatarPlaceholder}>
                <Text style={styles.fAvatarInitial}>{freelancer.fullName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.fInfo}>
              <Text style={styles.fLabel}>Freelancer</Text>
              <Text style={styles.fName}>{freelancer.fullName}</Text>
            </View>
            <TouchableOpacity style={styles.chatBtn} onPress={handleChat} activeOpacity={0.75}>
              <Text style={styles.chatBtnIcon}>💬</Text>
              <Text style={styles.chatBtnText}>Chat</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>${project.total_amount.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>${totalPaid.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Released</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{project.milestones.length}</Text>
              <Text style={styles.summaryLabel}>Milestones</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        {!!project.description && (
          <>
            <Text style={styles.sectionLabel}>Description</Text>
            <View style={styles.textBlock}>
              <Text style={styles.bodyText}>{project.description}</Text>
            </View>
          </>
        )}

        {/* Milestones timeline */}
        <Text style={styles.sectionLabel}>Milestones</Text>
        {project.milestones.length === 0 ? (
          <View style={styles.textBlock}>
            <Text style={styles.bodyText}>No milestones yet.</Text>
          </View>
        ) : (
          <View style={styles.milestoneList}>
            {project.milestones.map((m, idx) => {
              const isLast = idx === project.milestones.length - 1;
              const isDone = m.status === 'released';
              return (
                <View key={m.id} style={styles.milestoneRow}>
                  {/* Stepper line */}
                  <View style={styles.stepperCol}>
                    <View style={[styles.stepDot, isDone && styles.stepDotDone]} />
                    {!isLast && <View style={[styles.stepLine, isDone && styles.stepLineDone]} />}
                  </View>

                  <View style={styles.milestoneBody}>
                    <View style={styles.milestoneTitleRow}>
                      <Text style={[styles.milestoneTitle, isDone && styles.milestoneTitleDone]} numberOfLines={2}>
                        {m.title}
                      </Text>
                      <Text style={[styles.milestoneAmount, isDone && styles.milestoneAmountDone]}>
                        ${m.amount.toLocaleString()}
                      </Text>
                    </View>
                    {m.due_date && (
                      <Text style={styles.milestoneDue}>
                        Due {new Date(m.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    )}
                    <View style={[styles.mStatusBadge, isDone && styles.mStatusBadgeDone]}>
                      <Text style={[styles.mStatusText, isDone && styles.mStatusTextDone]}>
                        {isDone ? '✓ Released' : '○ Pending'}
                      </Text>
                    </View>

                    {/* Release button — only business owner, only pending milestones */}
                    {isBusiness && !isDone && project.status !== 'disputed' && (
                      <TouchableOpacity
                        style={[styles.releaseBtn, actionLoading && styles.releaseBtnDisabled]}
                        onPress={() => setReleaseTarget({ milestoneId: m.id, title: m.title, amount: m.amount })}
                        disabled={actionLoading}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.releaseBtnText}>💸 Release ${m.amount.toFixed(2)}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Business actions */}
        {isBusiness && project.status !== 'completed' && project.status !== 'disputed' && (
          <>
            <Text style={styles.sectionLabel}>Actions</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionCard, actionLoading && styles.actionCardDisabled]}
                onPress={handleRequestRevision}
                disabled={actionLoading}
                activeOpacity={0.75}
              >
                <Text style={styles.actionCardIcon}>📝</Text>
                <Text style={styles.actionCardLabel}>Request Revision</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCard, styles.actionCardDanger, actionLoading && styles.actionCardDisabled]}
                onPress={handleFlagDispute}
                disabled={actionLoading}
                activeOpacity={0.75}
              >
                <Text style={styles.actionCardIcon}>⚠️</Text>
                <Text style={[styles.actionCardLabel, styles.actionCardLabelDanger]}>Flag Dispute</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Contract */}
        <Text style={styles.sectionLabel}>Contract</Text>
        {contract ? (
          <TouchableOpacity style={styles.contractCard} onPress={handleViewContract} activeOpacity={0.8}>
            <View style={styles.contractCardTop}>
              <Text style={styles.contractCardIcon}>📄</Text>
              <View style={styles.contractCardInfo}>
                <Text style={styles.contractCardTitle}>Scope of Work Agreement</Text>
                <Text style={styles.contractCardSub} numberOfLines={2}>{contract.scope_text}</Text>
              </View>
            </View>
            <View style={styles.contractCardBottom}>
              <View style={[styles.contractStatusBadge, contract.status === 'active' && styles.contractStatusActive]}>
                <Text style={[styles.contractStatusText, contract.status === 'active' && styles.contractStatusTextActive]}>
                  {contract.status === 'active' ? '✓ Active' : contract.status === 'pending_signature' ? '⏳ Pending Signature' : 'Draft'}
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

      {/* Milestone release confirm modal */}
      {releaseTarget && freelancer && (
        <MilestoneReleaseConfirmModal
          visible={!!releaseTarget}
          milestoneTitle={releaseTarget.title}
          amount={releaseTarget.amount}
          freelancerName={freelancer.fullName}
          onConfirm={() => handleReleaseMilestone(releaseTarget.milestoneId)}
          onCancel={() => setReleaseTarget(null)}
        />
      )}
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

  freelancerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  fAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: spacing.sm,
  },
  fAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  fAvatarInitial: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  fInfo: { flex: 1 },
  fLabel: { fontSize: typography.fontSize.xs, color: colors.textMuted, marginBottom: 2 },
  fName: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chatBtnIcon: { fontSize: 14 },
  chatBtnText: { color: colors.black, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },

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
  summaryValue: { color: colors.textPrimary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
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
  bodyText: { color: colors.textPrimary, fontSize: typography.fontSize.base, lineHeight: 22 },

  milestoneList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  milestoneRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  stepperCol: {
    alignItems: 'center',
    width: 20,
    marginRight: spacing.sm,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray600,
    backgroundColor: colors.background,
  },
  stepDotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 40,
    backgroundColor: colors.border,
    marginTop: 2,
  },
  stepLineDone: { backgroundColor: colors.primary },
  milestoneBody: { flex: 1 },
  milestoneTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  milestoneTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
    marginRight: spacing.sm,
  },
  milestoneTitleDone: { color: colors.textMuted },
  milestoneAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
  },
  milestoneAmountDone: { color: colors.primary },
  milestoneDue: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginBottom: 6,
  },
  mStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  mStatusBadgeDone: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(46,204,113,0.12)',
  },
  mStatusText: { fontSize: typography.fontSize.xs, color: colors.textMuted },
  mStatusTextDone: { color: colors.primary, fontWeight: typography.fontWeight.semibold },

  releaseBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  releaseBtnDisabled: { opacity: 0.5 },
  releaseBtnText: {
    color: colors.black,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionCardDanger: {
    borderColor: 'rgba(231,76,60,0.4)',
    backgroundColor: 'rgba(231,76,60,0.08)',
  },
  actionCardDisabled: { opacity: 0.5 },
  actionCardIcon: { fontSize: 22 },
  actionCardLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  actionCardLabelDanger: { color: colors.error },

  contractCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  contractCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  contractCardIcon: { fontSize: 24, marginRight: spacing.md },
  contractCardInfo: { flex: 1 },
  contractCardTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 4,
  },
  contractCardSub: { color: colors.textSecondary, fontSize: typography.fontSize.sm, lineHeight: 18 },
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
  contractStatusActive: { borderColor: colors.primary, backgroundColor: 'rgba(46,204,113,0.12)' },
  contractStatusText: { color: colors.warning, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },
  contractStatusTextActive: { color: colors.primary },
  viewContractLink: { color: colors.primary, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
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
