import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MeetingType } from '../../types/messaging';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSchedule: (params: {
    meetingType: MeetingType;
    scheduledAt: string;
    title?: string;
  }) => Promise<void>;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildDays(count = 60): Array<{ date: Date; label: string; dayLabel: string }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      date: d,
      label: `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`,
      dayLabel: DAY_LABELS[d.getDay()],
    };
  });
}

function buildTimeSlots(): Array<{ label: string; hours: number; minutes: number }> {
  const slots: Array<{ label: string; hours: number; minutes: number }> = [];
  for (let h = 8; h <= 21; h++) {
    for (const m of [0, 30]) {
      if (h === 21 && m === 30) continue;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 || 12;
      const displayM = m === 0 ? '00' : '30';
      slots.push({ label: `${displayH}:${displayM} ${ampm}`, hours: h, minutes: m });
    }
  }
  return slots;
}

const DAYS = buildDays();
const TIME_SLOTS = buildTimeSlots();

export default function MeetingSchedulerModal({ visible, onClose, onSchedule }: Props) {
  const insets = useSafeAreaInsets();
  const [meetingType, setMeetingType] = useState<MeetingType>('in_person');
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState(0);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const dayListRef = useRef<FlatList>(null);

  const scheduledAt = useMemo(() => {
    const day = DAYS[selectedDayIdx].date;
    const slot = TIME_SLOTS[selectedSlotIdx];
    const d = new Date(day);
    d.setHours(slot.hours, slot.minutes, 0, 0);
    return d.toISOString();
  }, [selectedDayIdx, selectedSlotIdx]);

  const handleSchedule = useCallback(async () => {
    setLoading(true);
    try {
      await onSchedule({
        meetingType,
        scheduledAt,
        title: title.trim() || undefined,
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Could not schedule meeting. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [meetingType, scheduledAt, title, onSchedule, onClose]);

  const renderDay = useCallback(
    ({ item, index }: { item: typeof DAYS[0]; index: number }) => {
      const selected = index === selectedDayIdx;
      return (
        <TouchableOpacity
          style={[styles.dayChip, selected && styles.dayChipSelected]}
          onPress={() => setSelectedDayIdx(index)}
          activeOpacity={0.7}
        >
          <Text style={[styles.dayWeekday, selected && styles.dayWeekdaySelected]}>
            {item.dayLabel}
          </Text>
          <Text style={[styles.dayDate, selected && styles.dayDateSelected]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedDayIdx],
  );

  const renderSlot = useCallback(
    ({ item, index }: { item: typeof TIME_SLOTS[0]; index: number }) => {
      const selected = index === selectedSlotIdx;
      return (
        <TouchableOpacity
          style={[styles.timeChip, selected && styles.timeChipSelected]}
          onPress={() => setSelectedSlotIdx(index)}
          activeOpacity={0.7}
        >
          <Text style={[styles.timeText, selected && styles.timeTextSelected]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedSlotIdx],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Schedule Meeting</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Meeting type toggle */}
          <Text style={styles.sectionLabel}>MEETING TYPE</Text>
          <View style={styles.toggleRow}>
            {(['in_person', 'video_call'] as MeetingType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.toggleBtn, meetingType === t && styles.toggleBtnActive]}
                onPress={() => setMeetingType(t)}
                activeOpacity={0.8}
              >
                <Text style={styles.toggleIcon}>
                  {t === 'in_person' ? '🤝' : '📹'}
                </Text>
                <Text style={[styles.toggleLabel, meetingType === t && styles.toggleLabelActive]}>
                  {t === 'in_person' ? 'In Person' : 'Video Call'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date picker */}
          <Text style={styles.sectionLabel}>SELECT DATE</Text>
          <FlatList
            ref={dayListRef}
            data={DAYS}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderDay}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayList}
            getItemLayout={(_, index) => ({ length: 72, offset: 72 * index, index })}
          />

          {/* Time picker */}
          <Text style={styles.sectionLabel}>SELECT TIME</Text>
          <FlatList
            data={TIME_SLOTS}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderSlot}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timeList}
            getItemLayout={(_, index) => ({ length: 84, offset: 84 * index, index })}
          />

          {/* Optional title */}
          <Text style={styles.sectionLabel}>TITLE (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Project kickoff call"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          <TouchableOpacity
            style={[styles.scheduleBtn, loading && styles.scheduleBtnDisabled]}
            onPress={handleSchedule}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.black} size="small" />
            ) : (
              <Text style={styles.scheduleBtnText}>Send Meeting Request</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.gray700,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  closeBtn: {
    color: colors.textSecondary,
    fontSize: 18,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  toggleBtnActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(46,204,113,0.12)',
  },
  toggleIcon: {
    fontSize: 20,
  },
  toggleLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  toggleLabelActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  dayList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  dayChip: {
    width: 64,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  dayChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dayWeekday: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    marginBottom: 3,
  },
  dayWeekdaySelected: {
    color: 'rgba(0,0,0,0.65)',
  },
  dayDate: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  dayDateSelected: {
    color: colors.black,
  },
  timeList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  timeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  timeChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  timeText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  timeTextSelected: {
    color: colors.black,
    fontWeight: typography.fontWeight.bold,
  },
  input: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  scheduleBtn: {
    margin: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  scheduleBtnDisabled: {
    opacity: 0.6,
  },
  scheduleBtnText: {
    color: colors.black,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
