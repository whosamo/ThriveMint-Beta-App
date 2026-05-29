import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Message, MeetingMetadata, ProjectMetadata, ContractMetadata } from '../../types/messaging';
import { colors, typography, spacing, borderRadius } from '../../theme';
import MeetingCard from './MeetingCard';

interface Props {
  message: Message;
  isMine: boolean;
  currentUserId: string;
  onContractAction?: (projectId: string) => void;
  onContractPress?: (contractId: string, projectId: string) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function MessageBubble({
  message,
  isMine,
  currentUserId,
  onContractAction,
  onContractPress,
}: Props) {
  if (message.message_type === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  if (message.message_type === 'meeting') {
    const meta = message.metadata as MeetingMetadata | null;
    if (!meta) return null;
    return (
      <View style={[styles.cardRow, isMine ? styles.rowRight : styles.rowLeft]}>
        <MeetingCard
          meta={meta}
          isMine={isMine}
          currentUserId={currentUserId}
          attendeeId={isMine ? '' : message.sender_id}
        />
        <Text style={[styles.timestamp, isMine ? styles.timestampRight : styles.timestampLeft]}>
          {formatTime(message.created_at)}
        </Text>
      </View>
    );
  }

  if (message.message_type === 'project') {
    const meta = message.metadata as ProjectMetadata | null;
    if (!meta) return null;
    return (
      <View style={[styles.cardRow, isMine ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.projectCard, isMine ? styles.projectCardMine : styles.projectCardTheirs]}>
          <Text style={styles.projectLabel}>PROJECT PROPOSAL</Text>
          <Text style={styles.projectTitle} numberOfLines={2}>{meta.title}</Text>
          <View style={styles.projectMeta}>
            <View style={styles.projectStat}>
              <Text style={styles.projectStatValue}>${meta.total_amount.toLocaleString()}</Text>
              <Text style={styles.projectStatLabel}>Total</Text>
            </View>
            <View style={styles.projectDivider} />
            <View style={styles.projectStat}>
              <Text style={styles.projectStatValue}>{meta.milestone_count}</Text>
              <Text style={styles.projectStatLabel}>Milestones</Text>
            </View>
          </View>
          {isMine && onContractAction && (
            <TouchableOpacity
              style={styles.contractActionBtn}
              onPress={() => onContractAction(meta.project_id)}
              activeOpacity={0.75}
            >
              <Text style={styles.contractActionText}>📄 Generate Contract</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.timestamp, isMine ? styles.timestampRight : styles.timestampLeft]}>
          {formatTime(message.created_at)}
        </Text>
      </View>
    );
  }

  if (message.message_type === 'contract') {
    const meta = message.metadata as ContractMetadata | null;
    if (!meta) return null;
    return (
      <View style={[styles.cardRow, isMine ? styles.rowRight : styles.rowLeft]}>
        <TouchableOpacity
          style={[styles.contractCard, isMine ? styles.contractCardMine : styles.contractCardTheirs]}
          onPress={() => onContractPress?.(meta.contract_id, meta.project_id)}
          activeOpacity={0.8}
        >
          <View style={styles.contractCardHeader}>
            <Text style={styles.contractCardIcon}>📄</Text>
            <View>
              <Text style={styles.contractCardLabel}>CONTRACT</Text>
              <Text style={styles.contractCardSub}>Scope of Work Agreement</Text>
            </View>
          </View>
          <View style={[styles.contractBadge, meta.status === 'active' && styles.contractBadgeActive]}>
            <Text style={[styles.contractBadgeText, meta.status === 'active' && styles.contractBadgeTextActive]}>
              {meta.status === 'active'
                ? '✓ Active'
                : meta.status === 'pending_signature'
                ? '⏳ Awaiting Signature'
                : 'Draft'}
            </Text>
          </View>
        </TouchableOpacity>
        <Text style={[styles.timestamp, isMine ? styles.timestampRight : styles.timestampLeft]}>
          {formatTime(message.created_at)}
        </Text>
      </View>
    );
  }

  if (message.message_type === 'image' && message.file_url) {
    return (
      <View style={[styles.row, isMine ? styles.rowRight : styles.rowLeft]}>
        <Image source={{ uri: message.file_url }} style={styles.imageMsg} resizeMode="cover" />
        <Text style={[styles.timestamp, isMine ? styles.timestampRight : styles.timestampLeft]}>
          {formatTime(message.created_at)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, isMine ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
          {message.content}
        </Text>
      </View>
      <Text style={[styles.timestamp, isMine ? styles.timestampRight : styles.timestampLeft]}>
        {formatTime(message.created_at)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: 2,
    marginHorizontal: spacing.md,
    maxWidth: '80%',
  },
  rowRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  rowLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  cardRow: {
    marginVertical: spacing.xs,
    marginHorizontal: spacing.md,
    maxWidth: '85%',
  },
  bubble: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.surfaceElevated,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },
  bubbleTextMine: {
    color: colors.black,
  },
  bubbleTextTheirs: {
    color: colors.textPrimary,
  },
  imageMsg: {
    width: 220,
    height: 160,
    borderRadius: borderRadius.md,
  },
  timestamp: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: 3,
  },
  timestampRight: {
    textAlign: 'right',
  },
  timestampLeft: {
    textAlign: 'left',
  },
  systemRow: {
    alignSelf: 'center',
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: borderRadius.full,
  },
  systemText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  projectCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    minWidth: 220,
  },
  projectCardMine: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderColor: colors.primary,
  },
  projectCardTheirs: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  projectLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  projectTitle: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  projectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectStat: {
    flex: 1,
    alignItems: 'center',
  },
  projectStatValue: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  projectStatLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  projectDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  contractActionBtn: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  contractActionText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  contractCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    minWidth: 220,
  },
  contractCardMine: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderColor: colors.primary,
  },
  contractCardTheirs: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  contractCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  contractCardIcon: { fontSize: 22 },
  contractCardLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
  },
  contractCardSub: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
  contractBadge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  contractBadgeActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(46,204,113,0.12)',
  },
  contractBadgeText: {
    color: colors.warning,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  contractBadgeTextActive: { color: colors.primary },
});
