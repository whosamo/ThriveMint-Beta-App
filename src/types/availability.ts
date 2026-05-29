export type AvailabilityStatus = 'available' | 'busy' | 'partial';

export interface AvailabilityEntry {
  freelancer_user_id: string;
  date: string; // YYYY-MM-DD
  status: AvailabilityStatus;
}

export const RESPONSE_TIME_LABELS: Record<string, string> = {
  within_1_hour: 'Within 1 hour',
  same_day: 'Same day',
  within_48_hours: 'Within 48 hours',
  within_a_week: 'Within a week',
};

export const STATUS_COLOR: Record<AvailabilityStatus, string> = {
  available: 'rgba(46,204,113,0.85)',
  busy: 'rgba(100,100,100,0.70)',
  partial: 'rgba(243,156,18,0.75)',
};
