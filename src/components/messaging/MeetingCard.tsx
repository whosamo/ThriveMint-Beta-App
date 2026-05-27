import React, { useCallback } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MeetingMetadata } from '../../types/messaging';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { confirmMeeting } from '../../services/messagingService';

interface Props {
  meta: MeetingMetadata;
  isMine: boolean;
  currentUserId: string;
  attendeeId: string;
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatMeetingDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const time = `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
  return { date, time };
}

const STATUS_COLORS: Record<string, string> = {
  pending: colors.warning,
  confirmed: colors.success,
  cancelled: colors.error,
};

export default function MeetingCard({ meta, isMine, currentUserId, attendeeId }: Props) {
  const [status, setStatus] = React.useState(meta.status);
  const [loading, setLoading] = React.useState(false);
  const { date, time } = formatMeetingDate(meta.scheduled_at);

  const isAttendee = !isMine || currentUserId === attendeeId;
  const canConfirm = status === 'pending' && !isMine;

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await confirmMeeting(meta.meeting_id);
      setStatus('confirmed');
    } catch {
      Alert.alert('Error', 'Could not confirm meeting. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [meta.meeting_id]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.typeIcon}>
          {meta.meeting_type === 'video_call' ? '📹' : '🤝'}
        </Text>
        <View style={styles.headerText}>
          <Text style={styles.typeLabel}>
            {meta.meeting_type === 'video_call' ? 'Video Call' : 'In-Person Meeting'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] + '25' }]}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
            <Text style={[styles.statusText, { color: STATUS_COLORS[status] }]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.date}>{date}</Text>
        <Text style={styles.timeSep}>·</Text>
        <Text style={styles.time}>{time}</Text>
      </View>

      {canConfirm && (
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirm}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.black} />
          ) : (
            <Text style={styles.confirmText}>Confirm Meeting</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minWidth: 240,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeIcon: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  typeLabel: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  date: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
  },
  timeSep: {
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },
  time: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  confirmText: {
    color: colors.black,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
});
