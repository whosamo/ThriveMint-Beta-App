export type ReportReason =
  | 'fake_profile'
  | 'spam_or_scam'
  | 'inappropriate_content'
  | 'harassment'
  | 'off_platform_payment'
  | 'other';

export type ContentType = 'profile' | 'message' | 'portfolio_item';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'fake_profile',         label: 'Fake profile' },
  { value: 'spam_or_scam',         label: 'Spam or scam' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'harassment',           label: 'Harassment' },
  { value: 'off_platform_payment', label: 'Soliciting off-platform payment' },
  { value: 'other',                label: 'Other' },
];

export interface ReportPayload {
  reportedUserId: string;
  contentType: ContentType;
  contentId?: string;
  reason: ReportReason;
  details?: string;
}
