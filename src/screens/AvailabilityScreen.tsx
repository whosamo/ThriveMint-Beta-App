import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  PanResponder,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { getAvailabilityRange, replaceMonthAvailability } from '../services/availabilityService';
import { AvailabilityStatus, STATUS_COLOR, RESPONSE_TIME_LABELS } from '../types/availability';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_W = (SCREEN_WIDTH - 2 * spacing.md) / 7;
const CELL_H = 44;
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const STATUS_CYCLE: (AvailabilityStatus | null)[] = [null, 'available', 'busy', 'partial'];

const RESPONSE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Within 1 hour', value: 'within_1_hour' },
  { label: 'Same day', value: 'same_day' },
  { label: 'Within 48 hrs', value: 'within_48_hours' },
  { label: 'Within a week', value: 'within_a_week' },
];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function nextStatus(s: AvailabilityStatus | null): AvailabilityStatus | null {
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length];
}

const TODAY = new Date().toISOString().split('T')[0];

export default function AvailabilityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [dayStatuses, setDayStatuses] = useState<Record<string, AvailabilityStatus>>({});
  const [acceptingWork, setAcceptingWork] = useState(true);
  const [responseTime, setResponseTime] = useState('within_48_hours');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Refs for PanResponder callbacks
  const calRef = useRef({ year, month, firstDay: firstWeekDay(year, month), numDays: daysInMonth(year, month) });
  const statusesRef = useRef(dayStatuses);
  const gridX = useRef(0);
  const gridY = useRef(0);
  const dragTarget = useRef<AvailabilityStatus | null>(null);
  const lastDragDate = useRef<string | null>(null);
  const gridRef = useRef<View>(null);

  useEffect(() => {
    const fd = firstWeekDay(year, month);
    const nd = daysInMonth(year, month);
    calRef.current = { year, month, firstDay: fd, numDays: nd };
  }, [year, month]);

  useEffect(() => { statusesRef.current = dayStatuses; }, [dayStatuses]);

  // Auth + profile load
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data: fp } = await supabase
        .from('freelancer_profiles')
        .select('id, accepting_new_work, typical_response_time')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fp) {
        setProfileId(fp.id);
        setAcceptingWork(fp.accepting_new_work ?? true);
        setResponseTime(fp.typical_response_time ?? 'within_48_hours');
      }

      setLoading(false);
    });
  }, []);

  // Load month availability
  useEffect(() => {
    if (!userId) return;
    const start = toISO(year, month, 1);
    const end = toISO(year, month, daysInMonth(year, month));
    getAvailabilityRange(userId, start, end).then((map) => {
      setDayStatuses((prev) => {
        const next = { ...prev };
        // clear current month
        for (let d = 1; d <= daysInMonth(year, month); d++) delete next[toISO(year, month, d)];
        return { ...next, ...map };
      });
    });
  }, [userId, year, month]);

  function dateAtPoint(px: number, py: number): string | null {
    const { year: y, month: m, firstDay, numDays } = calRef.current;
    const col = Math.floor((px - gridX.current) / CELL_W);
    const row = Math.floor((py - gridY.current) / CELL_H);
    const numRows = Math.ceil((firstDay + numDays) / 7);
    if (col < 0 || col >= 7 || row < 0 || row >= numRows) return null;
    const day = row * 7 + col - firstDay + 1;
    if (day < 1 || day > numDays) return null;
    return toISO(y, m, day);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const date = dateAtPoint(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        if (!date) return;
        const cycled = nextStatus(statusesRef.current[date] ?? null);
        dragTarget.current = cycled;
        lastDragDate.current = date;
        setDayStatuses((prev) => {
          const next = { ...prev };
          if (cycled === null) delete next[date];
          else next[date] = cycled;
          return next;
        });
      },
      onPanResponderMove: (evt) => {
        const date = dateAtPoint(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        if (!date || date === lastDragDate.current) return;
        lastDragDate.current = date;
        const target = dragTarget.current;
        setDayStatuses((prev) => {
          const next = { ...prev };
          if (target === null) delete next[date];
          else next[date] = target;
          return next;
        });
      },
      onPanResponderRelease: () => {
        dragTarget.current = null;
        lastDragDate.current = null;
      },
    }),
  ).current;

  const prevMonth = useCallback(() => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }, [month]);

  const handleSave = useCallback(async () => {
    if (!userId || !profileId) {
      Alert.alert('Error', 'No freelancer profile found. Only freelancers can set availability.');
      return;
    }
    setSaving(true);
    try {
      const nd = daysInMonth(year, month);
      const entries = [];
      for (let d = 1; d <= nd; d++) {
        const date = toISO(year, month, d);
        const status = dayStatuses[date];
        if (status) entries.push({ freelancer_user_id: userId, date, status });
      }
      await replaceMonthAvailability(userId, year, month, entries);
      await supabase
        .from('freelancer_profiles')
        .update({ accepting_new_work: acceptingWork, typical_response_time: responseTime })
        .eq('id', profileId);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [userId, profileId, year, month, dayStatuses, acceptingWork, responseTime, navigation]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const firstDay = firstWeekDay(year, month);
  const numDays = daysInMonth(year, month);
  const numRows = Math.ceil((firstDay + numDays) / 7);
  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' });
  const canSave = !!profileId;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Availability</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !canSave}
          style={[styles.saveBtn, (saving || !canSave) && styles.saveBtnDisabled]}
        >
          {saving ? (
            <ActivityIndicator color={colors.black} size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!profileId && (
          <View style={styles.noProfileBanner}>
            <Text style={styles.noProfileText}>
              Availability is only available for freelancer accounts.
            </Text>
          </View>
        )}

        {/* Master toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleLabel}>Available for new projects</Text>
            <Text style={styles.toggleSub}>
              When off, your profile shows "Not taking new work"
            </Text>
          </View>
          <Switch
            value={acceptingWork}
            onValueChange={setAcceptingWork}
            trackColor={{ false: colors.gray700, true: colors.primaryDark }}
            thumbColor={acceptingWork ? colors.primary : colors.gray400}
          />
        </View>

        {/* Response time */}
        <Text style={styles.sectionLabel}>Typical Response Time</Text>
        <View style={styles.chipGrid}>
          {RESPONSE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, responseTime === opt.value && styles.chipActive]}
              onPress={() => setResponseTime(opt.value)}
            >
              <Text style={[styles.chipText, responseTime === opt.value && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calendar */}
        <Text style={styles.sectionLabel}>Monthly Calendar</Text>
        <Text style={styles.calHint}>Tap or drag to mark days. Tap again to cycle status.</Text>

        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.monthArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthName} {year}</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.monthArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Day name headers */}
        <View style={styles.dayHeaders}>
          {DAY_NAMES.map((d) => (
            <View key={d} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Grid with drag gesture */}
        <View
          ref={gridRef}
          onLayout={() => {
            gridRef.current?.measure((_x, _y, _w, _h, px, py) => {
              gridX.current = px;
              gridY.current = py;
            });
          }}
          {...panResponder.panHandlers}
        >
          {Array.from({ length: numRows }, (_, row) => (
            <View key={row} style={styles.calRow}>
              {Array.from({ length: 7 }, (_, col) => {
                const cellIdx = row * 7 + col;
                const day = cellIdx - firstDay + 1;
                const isInMonth = day >= 1 && day <= numDays;
                const date = isInMonth ? toISO(year, month, day) : null;
                const status = date ? (dayStatuses[date] ?? null) : null;
                const isToday = date === TODAY;
                return (
                  <View
                    key={col}
                    style={[
                      styles.calCell,
                      status ? { backgroundColor: STATUS_COLOR[status] } : null,
                      isToday && styles.calCellToday,
                    ]}
                  >
                    {isInMonth && (
                      <Text
                        style={[
                          styles.calDayNum,
                          !!status && styles.calDayNumFilled,
                          isToday && !status && styles.calDayNumToday,
                        ]}
                      >
                        {day}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {([['available', 'Available'], ['partial', 'Partial (quick projects)'], ['busy', 'Busy']] as const).map(
            ([status, label]) => (
              <View key={status} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR[status] }]} />
                <Text style={styles.legendLabel}>{label}</Text>
              </View>
            ),
          )}
        </View>

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
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    minWidth: 64,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    color: colors.black,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md },
  noProfileBanner: {
    backgroundColor: 'rgba(231,76,60,0.10)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noProfileText: { color: colors.error, fontSize: typography.fontSize.sm },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  toggleTextWrap: { flex: 1, marginRight: spacing.md },
  toggleLabel: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2,
  },
  toggleSub: { color: colors.textSecondary, fontSize: typography.fontSize.xs },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(46,204,113,0.12)' },
  chipText: { color: colors.textSecondary, fontSize: typography.fontSize.sm },
  chipTextActive: { color: colors.primary, fontWeight: typography.fontWeight.semibold },
  calHint: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.sm,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthArrow: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '300' as const,
    paddingHorizontal: spacing.md,
  },
  monthTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  dayHeaders: { flexDirection: 'row', marginBottom: spacing.xs },
  dayHeaderCell: { width: CELL_W, alignItems: 'center' },
  dayHeaderText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  calRow: { flexDirection: 'row' },
  calCell: {
    width: CELL_W,
    height: CELL_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  calCellToday: { borderColor: colors.primary, borderWidth: 1.5 },
  calDayNum: { color: colors.textSecondary, fontSize: typography.fontSize.sm },
  calDayNumFilled: { color: colors.white, fontWeight: typography.fontWeight.semibold },
  calDayNumToday: { color: colors.primary, fontWeight: typography.fontWeight.bold },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { color: colors.textSecondary, fontSize: typography.fontSize.xs },
});
