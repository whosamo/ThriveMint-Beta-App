import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { getOrCreateConversation } from '../services/messagingService';
import { colors, typography, spacing, borderRadius } from '../theme';
import { RootStackParamList } from '../navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type ProjectStatus = 'active' | 'completed' | 'disputed' | 'pending';

interface ProjectRow {
  id: string;
  title: string;
  status: ProjectStatus;
  total_amount: number;
  freelancer_user_id: string;
  conversation_id: string | null;
  freelancer_name: string;
  freelancer_avatar: string | null;
  next_milestone_due: string | null;
}

const TABS: { label: string; statuses: ProjectStatus[] }[] = [
  { label: 'Active', statuses: ['active', 'pending'] },
  { label: 'Completed', statuses: ['completed'] },
  { label: 'Disputed', statuses: ['disputed'] },
];

const STATUS_COLOR: Record<ProjectStatus, string> = {
  pending: colors.warning,
  active: colors.primary,
  completed: colors.info,
  disputed: colors.error,
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  completed: 'Completed',
  disputed: 'Disputed',
};

function formatDue(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 7) return `Due in ${days}d`;
  return `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export default function ProjectsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;

    const { data: rows, error } = await supabase
      .from('projects')
      .select('id, title, status, total_amount, freelancer_user_id, conversation_id, created_at')
      .eq('business_user_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !rows || rows.length === 0) {
      setProjects([]);
      return;
    }

    const freelancerIds = [...new Set(rows.map((r) => r.freelancer_user_id))];
    const projectIds = rows.map((r) => r.id);

    const [usersRes, milestonesRes] = await Promise.all([
      supabase.from('users').select('id, full_name, avatar_url').in('id', freelancerIds),
      supabase
        .from('milestones')
        .select('project_id, due_date, status')
        .in('project_id', projectIds)
        .eq('status', 'pending')
        .order('due_date', { ascending: true }),
    ]);

    const userMap = new Map((usersRes.data ?? []).map((u: any) => [u.id, u]));

    // Find earliest pending milestone per project
    const nextDueMap = new Map<string, string>();
    for (const m of milestonesRes.data ?? []) {
      if (!nextDueMap.has(m.project_id) && m.due_date) {
        nextDueMap.set(m.project_id, m.due_date);
      }
    }

    const result: ProjectRow[] = rows.map((r) => {
      const u = userMap.get(r.freelancer_user_id);
      return {
        id: r.id,
        title: r.title,
        status: r.status as ProjectStatus,
        total_amount: r.total_amount ?? 0,
        freelancer_user_id: r.freelancer_user_id,
        conversation_id: r.conversation_id ?? null,
        freelancer_name: u?.full_name ?? 'Unknown',
        freelancer_avatar: u?.avatar_url ?? null,
        next_milestone_due: nextDueMap.get(r.id) ?? null,
      };
    });

    setProjects(result);
  }, [user]);

  useEffect(() => {
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  const handleProjectPress = useCallback(
    async (project: ProjectRow) => {
      if (!user) return;
      let convId = project.conversation_id;
      if (!convId) {
        try {
          convId = await getOrCreateConversation(user.id, project.freelancer_user_id);
        } catch {
          convId = '';
        }
      }
      navigation.navigate('ProjectDetail', {
        projectId: project.id,
        conversationId: convId ?? '',
      });
    },
    [user, navigation],
  );

  const filteredProjects = projects.filter((p) =>
    TABS[activeTab].statuses.includes(p.status),
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Projects</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab, i) => {
          const count = projects.filter((p) => tab.statuses.includes(p.status)).length;
          return (
            <TouchableOpacity
              key={tab.label}
              style={[styles.tab, activeTab === i && styles.tabActive]}
              onPress={() => setActiveTab(i)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
                {tab.label}
                {count > 0 && ` (${count})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredProjects}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={filteredProjects.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No {TABS[activeTab].label.toLowerCase()} projects</Text>
            <Text style={styles.emptySub}>Projects with freelancers will appear here once created.</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const statusColor = STATUS_COLOR[item.status];
          const avatarUrl = item.freelancer_avatar
            ? supabase.storage.from('avatars').getPublicUrl(item.freelancer_avatar).data.publicUrl
            : null;
          const dueLabel = formatDue(item.next_milestone_due);
          const isOverdue = dueLabel === 'Overdue';

          return (
            <TouchableOpacity
              style={styles.projectRow}
              onPress={() => handleProjectPress(item)}
              activeOpacity={0.75}
            >
              {/* Freelancer avatar */}
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{item.freelancer_name.charAt(0).toUpperCase()}</Text>
                </View>
              )}

              <View style={styles.projectInfo}>
                <Text style={styles.projectTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.freelancerName} numberOfLines={1}>{item.freelancer_name}</Text>
                {dueLabel && (
                  <Text style={[styles.dueLabel, isOverdue && styles.dueLabelOverdue]}>
                    {dueLabel}
                  </Text>
                )}
              </View>

              <View style={styles.rightCol}>
                <View style={[styles.statusBadge, { borderColor: statusColor }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
                <Text style={styles.amount}>${item.total_amount.toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(46,204,113,0.12)',
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 80,
  },
  emptyContainer: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: spacing.md,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarInitial: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  projectInfo: { flex: 1, marginRight: spacing.sm },
  projectTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  freelancerName: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  dueLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
  dueLabelOverdue: {
    color: colors.error,
    fontWeight: typography.fontWeight.semibold,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  statusBadge: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  amount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
});
