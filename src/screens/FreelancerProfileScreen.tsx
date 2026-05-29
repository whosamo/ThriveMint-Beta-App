import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { RootStackParamList } from '../navigation/RootNavigator';
import { supabase } from '../services/supabase';
import { getOrCreateConversation } from '../services/messagingService';
import { getAvailabilityRange } from '../services/availabilityService';
import { colors, typography, spacing, borderRadius } from '../theme';
import { haversineDistanceMiles } from '../utils/haversine';
import { PortfolioItem, ReviewItem } from '../types/feed';
import { AvailabilityStatus, STATUS_COLOR, RESPONSE_TIME_LABELS } from '../types/availability';
import PortfolioViewer from '../components/feed/PortfolioViewer';

type Props = NativeStackScreenProps<RootStackParamList, 'FreelancerProfile'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COVER_HEIGHT = Math.round(SCREEN_HEIGHT * 0.46);
const CELL_GAP = spacing.xs;
const CELL_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - CELL_GAP) / 2;

interface ProfileState {
  freelancerId: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  bio: string | null;
  hourlyRate: number | null;
  availability: string;
  serviceCategories: string[];
  verificationStatus: string;
  badges: string[];
  yearsExperience: number | null;
  portfolioItems: PortfolioItem[];
  acceptingNewWork: boolean;
  typicalResponseTime: string;
}

const BADGE_CONFIG: Record<string, { bg: string; color: string }> = {
  'Local Verified': { bg: 'rgba(46,204,113,0.18)', color: '#2ECC71' },
  'Top Rated':      { bg: 'rgba(243,156,18,0.18)',  color: '#F39C12' },
  'Rising Star':    { bg: 'rgba(155,89,182,0.18)',   color: '#9B59B6' },
  'On-Time':        { bg: 'rgba(52,152,219,0.18)',   color: '#3498DB' },
  'Top Communicator': { bg: 'rgba(26,188,156,0.18)', color: '#1ABC9C' },
};

const AVAIL_LABELS: Record<string, string> = {
  full_time:   'Full-time',
  part_time:   'Part-time',
  contract:    'Contract',
  unavailable: 'Unavailable',
};

const FILTER_TABS = ['All', 'Videos', 'Images', 'Before & After', 'Testimonials'] as const;
type FilterTab = (typeof FILTER_TABS)[number];

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={{ fontSize: size, color: i <= Math.round(rating) ? colors.warning : colors.gray700 }}>
          ★
        </Text>
      ))}
    </View>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function FreelancerProfileScreen({ route, navigation }: Props) {
  const { freelancerId } = route.params;
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [availabilityStrip, setAvailabilityStrip] = useState<Record<string, AvailabilityStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewerItem, setViewerItem] = useState<PortfolioItem | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('All');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserLoc, setCurrentUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        setCurrentUserId(user.id);

        const { data: fp, error: fpErr } = await supabase
          .from('freelancer_profiles')
          .select(`
            id, bio, hourly_rate, availability, service_categories,
            verification_status, badges, years_experience,
            accepting_new_work, typical_response_time,
            users!inner(id, full_name, avatar_url, city, state, lat, lng),
            portfolio_items(id, media_url, type, title, description, created_at)
          `)
          .eq('id', freelancerId)
          .single();

        if (fpErr) throw fpErr;
        if (cancelled) return;

        const u = Array.isArray(fp.users) ? fp.users[0] : fp.users as any;

        const today = new Date();
        const stripStart = today.toISOString().split('T')[0];
        const stripEnd = new Date(today.getTime() + 13 * 86400000).toISOString().split('T')[0];

        const [reviewsRes, shortlistRes, locRes, stripMap] = await Promise.all([
          supabase
            .from('reviews')
            .select('id, rating, comment, created_at, reviewer_id')
            .eq('reviewee_id', u.id)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('shortlists')
            .select('id')
            .eq('business_user_id', user.id)
            .eq('freelancer_user_id', u.id)
            .maybeSingle(),
          supabase
            .from('users')
            .select('lat, lng')
            .eq('id', user.id)
            .single(),
          getAvailabilityRange(u.id, stripStart, stripEnd),
        ]);

        if (cancelled) return;

        // Enrich reviews with reviewer names
        const rawReviews = reviewsRes.data ?? [];
        const reviewerIds = rawReviews.map((r: any) => r.reviewer_id).filter(Boolean);
        let reviewerRows: any[] = [];
        if (reviewerIds.length > 0) {
          const { data } = await supabase
            .from('users')
            .select('id, full_name, avatar_url')
            .in('id', reviewerIds);
          reviewerRows = data ?? [];
        }
        if (cancelled) return;

        const rMap = new Map(reviewerRows.map((r: any) => [r.id, r]));
        const mappedReviews: ReviewItem[] = rawReviews.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          reviewer_name: rMap.get(r.reviewer_id)?.full_name ?? 'Anonymous',
          reviewer_avatar_url: rMap.get(r.reviewer_id)?.avatar_url ?? null,
        }));

        // Sort portfolio: video first, then newest
        const rawItems = (Array.isArray(fp.portfolio_items) ? fp.portfolio_items : []) as any[];
        const sortedItems: PortfolioItem[] = rawItems
          .sort((a, b) => {
            if (a.type === 'video' && b.type !== 'video') return -1;
            if (a.type !== 'video' && b.type === 'video') return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          })
          .map(p => ({
            id: p.id,
            media_url: p.media_url,
            type: p.type as PortfolioItem['type'],
            title: p.title ?? null,
            description: p.description ?? null,
          }));

        setProfile({
          freelancerId: fp.id,
          userId: u.id,
          fullName: u.full_name,
          avatarUrl: u.avatar_url,
          city: u.city,
          state: u.state,
          lat: u.lat ?? null,
          lng: u.lng ?? null,
          bio: fp.bio ?? null,
          hourlyRate: fp.hourly_rate ?? null,
          availability: fp.availability,
          serviceCategories: fp.service_categories ?? [],
          verificationStatus: fp.verification_status,
          badges: fp.badges ?? [],
          yearsExperience: fp.years_experience ?? null,
          portfolioItems: sortedItems,
          acceptingNewWork: fp.accepting_new_work ?? true,
          typicalResponseTime: fp.typical_response_time ?? 'within_48_hours',
        });
        setReviews(mappedReviews);
        setAvailabilityStrip(stripMap);
        setIsShortlisted(shortlistRes.data != null);

        const loc = locRes.data as any;
        if (loc?.lat && loc?.lng) setCurrentUserLoc({ lat: loc.lat, lng: loc.lng });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [freelancerId]);

  const distanceLabel = useMemo(() => {
    if (!currentUserLoc || !profile?.lat || !profile?.lng) return null;
    const d = haversineDistanceMiles(currentUserLoc.lat, currentUserLoc.lng, profile.lat, profile.lng);
    return d < 1 ? '< 1 mi' : `${Math.round(d)} mi`;
  }, [currentUserLoc, profile]);

  const avgRating = useMemo(
    () => reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0,
    [reviews],
  );

  const computedBadges = useMemo(() => {
    if (!profile) return [];
    const b = [...(profile.badges ?? [])];
    if (profile.verificationStatus === 'approved' && !b.includes('Local Verified')) b.unshift('Local Verified');
    if (avgRating >= 4.5 && reviews.length >= 5 && !b.includes('Top Rated')) b.push('Top Rated');
    if (reviews.length >= 1 && reviews.length < 10 && avgRating >= 4.0 && !b.includes('Rising Star')) b.push('Rising Star');
    return b;
  }, [profile, avgRating, reviews.length]);

  const filteredPortfolio = useMemo(() => {
    if (!profile) return [];
    switch (activeTab) {
      case 'Videos':       return profile.portfolioItems.filter(p => p.type === 'video');
      case 'Images':       return profile.portfolioItems.filter(p => p.type === 'image');
      case 'Before & After': return profile.portfolioItems.filter(p => p.type === 'before_after');
      case 'Testimonials': return profile.portfolioItems.filter(p => p.type === 'testimonial');
      default:             return profile.portfolioItems;
    }
  }, [profile, activeTab]);

  const tagline = useMemo(() => {
    if (!profile) return '';
    return profile.serviceCategories.slice(0, 2).join(' · ') || 'Freelancer';
  }, [profile]);

  const coverItem = profile?.portfolioItems[0] ?? null;
  const coverUrl = coverItem
    ? supabase.storage.from('portfolios').getPublicUrl(coverItem.media_url).data.publicUrl
    : null;
  const avatarPublicUrl = profile?.avatarUrl
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatarUrl).data.publicUrl
    : null;

  const doShortlist = useCallback(async () => {
    if (!currentUserId || !profile) return;
    setIsSaving(true);
    setIsShortlisted(true);
    const { error: e } = await supabase
      .from('shortlists')
      .upsert({ business_user_id: currentUserId, freelancer_user_id: profile.userId });
    if (e) {
      setIsShortlisted(false);
      Alert.alert('Error', 'Could not save to shortlist. Please try again.');
    }
    setIsSaving(false);
  }, [currentUserId, profile]);

  const handleShortlist = useCallback(async () => {
    if (!currentUserId || !profile || isShortlisted) return;

    const todayKey = new Date().toISOString().split('T')[0];
    const todayStatus = availabilityStrip[todayKey];
    const isUnavailable = !profile.acceptingNewWork || todayStatus === 'busy';

    if (isUnavailable) {
      Alert.alert(
        'Freelancer may be busy',
        profile.acceptingNewWork
          ? `${profile.fullName} has marked today as busy. They may not respond quickly.`
          : `${profile.fullName} is not currently accepting new work.`,
        [
          { text: 'Message Anyway', onPress: () => doShortlist() },
          {
            text: 'Find Available Alternatives',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
        ],
      );
      return;
    }

    await doShortlist();
  }, [currentUserId, profile, isShortlisted, availabilityStrip, doShortlist, navigation]);

  const handleMessage = useCallback(async () => {
    if (!isShortlisted) {
      Alert.alert('Shortlist first', 'Save this freelancer to your shortlist to unlock messaging.');
      return;
    }
    if (!currentUserId || !profile) return;
    try {
      const conversationId = await getOrCreateConversation(currentUserId, profile.userId);
      navigation.navigate('Chat', {
        conversationId,
        otherUserId: profile.userId,
        otherUserName: profile.fullName,
        otherUserAvatar: profile.avatarUrl,
      });
    } catch {
      Alert.alert('Error', 'Could not open conversation. Please try again.');
    }
  }, [isShortlisted, currentUserId, profile, navigation]);

  // ── Loading / Error ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Profile not found'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ctaBottom = insets.bottom || 16;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 + ctaBottom }}
      >
        {/* ── Cover ──────────────────────────────────────────────────── */}
        <View style={styles.cover}>
          {coverUrl && coverItem?.type === 'video' ? (
            <Video
              source={{ uri: coverUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted
            />
          ) : coverUrl ? (
            <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.coverFallback]}>
              {avatarPublicUrl && (
                <Image
                  source={{ uri: avatarPublicUrl }}
                  style={[StyleSheet.absoluteFillObject, { opacity: 0.22 }]}
                  resizeMode="cover"
                  blurRadius={10}
                />
              )}
            </View>
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.93)']}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Back */}
          <TouchableOpacity style={[styles.backBtn, { top: (insets.top || 44) + 8 }]} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>

          {/* Distance badge */}
          {distanceLabel && (
            <View style={[styles.distancePill, { top: (insets.top || 44) + 12 }]}>
              <Text style={styles.distancePillText}>{distanceLabel}</Text>
            </View>
          )}

          {/* Identity */}
          <View style={styles.coverIdentity}>
            {avatarPublicUrl ? (
              <Image source={{ uri: avatarPublicUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{profile.fullName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.identityText}>
              <View style={styles.nameRow}>
                <Text style={styles.coverName} numberOfLines={1}>{profile.fullName}</Text>
                {profile.verificationStatus === 'approved' && (
                  <View style={styles.verifiedDot}>
                    <Text style={styles.verifiedIcon}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={styles.coverTagline} numberOfLines={1}>{tagline}</Text>
            </View>
          </View>
        </View>

        {/* ── Badges ─────────────────────────────────────────────────── */}
        {computedBadges.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.badgesScroll}
            contentContainerStyle={styles.badgesContent}
          >
            {computedBadges.map(badge => {
              const cfg = BADGE_CONFIG[badge] ?? { bg: 'rgba(163,163,163,0.15)', color: colors.gray400 };
              return (
                <View key={badge} style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                  <Text style={[styles.badgeText, { color: cfg.color }]}>{badge}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.divider} />

        {/* ── Availability Strip ──────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Availability</Text>
            {profile.acceptingNewWork ? (
              <View style={styles.availNowPill}>
                <Text style={styles.availNowPillText}>● Open to work</Text>
              </View>
            ) : (
              <View style={styles.unavailPill}>
                <Text style={styles.unavailPillText}>Not taking new work</Text>
              </View>
            )}
          </View>

          <View style={styles.stripRow}>
            {Array.from({ length: 14 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() + i);
              const key = d.toISOString().split('T')[0];
              const status = availabilityStrip[key] ?? null;
              const dayNum = d.getDate();
              const dayName = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()];
              const bg = status ? STATUS_COLOR[status] : 'rgba(255,255,255,0.06)';
              return (
                <View key={key} style={styles.stripCell}>
                  <Text style={styles.stripDayName}>{dayName}</Text>
                  <View style={[styles.stripDot, { backgroundColor: bg }]}>
                    <Text style={styles.stripDayNum}>{dayNum}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.stripLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR.available }]} />
              <Text style={styles.legendText}>Available</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR.partial }]} />
              <Text style={styles.legendText}>Partial</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR.busy }]} />
              <Text style={styles.legendText}>Busy</Text>
            </View>
          </View>

          <Text style={styles.responseTimeLabel}>
            Typically responds:{' '}
            <Text style={styles.responseTimeValue}>
              {RESPONSE_TIME_LABELS[profile.typicalResponseTime] ?? 'Within 48 hours'}
            </Text>
          </Text>
        </View>

        <View style={styles.divider} />

        {/* ── About ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}

          <View style={styles.statsRow}>
            {profile.hourlyRate != null && (
              <View style={styles.statChip}>
                <Text style={styles.statChipText}>${profile.hourlyRate}/hr</Text>
              </View>
            )}
            <View style={[
              styles.statChip,
              profile.availability !== 'unavailable' && styles.statChipGreen,
            ]}>
              <Text style={[
                styles.statChipText,
                profile.availability !== 'unavailable' && { color: colors.primary },
              ]}>
                {AVAIL_LABELS[profile.availability] ?? profile.availability}
              </Text>
            </View>
            {profile.yearsExperience != null && (
              <View style={styles.statChip}>
                <Text style={styles.statChipText}>
                  {profile.yearsExperience} yr{profile.yearsExperience !== 1 ? 's' : ''} exp
                </Text>
              </View>
            )}
          </View>

          {profile.serviceCategories.length > 0 && (
            <View style={styles.tagsRow}>
              {profile.serviceCategories.map(cat => (
                <View key={cat} style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>{cat}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* ── Portfolio ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            <Text style={styles.sectionCount}>{profile.portfolioItems.length} items</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsContent}
          >
            {FILTER_TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredPortfolio.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No items in this category</Text>
            </View>
          ) : (
            <View style={styles.portfolioGrid}>
              {filteredPortfolio.map(item => {
                const url = supabase.storage.from('portfolios').getPublicUrl(item.media_url).data.publicUrl;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.portfolioCell}
                    onPress={() => setViewerItem(item)}
                    activeOpacity={0.82}
                  >
                    <Image source={{ uri: url }} style={styles.portfolioThumb} resizeMode="cover" />
                    {item.type === 'video' && (
                      <View style={styles.playOverlay}>
                        <Text style={styles.playIcon}>▶</Text>
                      </View>
                    )}
                    {(item.type === 'before_after' || item.type === 'testimonial') && (
                      <View style={styles.categoryLabel}>
                        <Text style={styles.categoryLabelText}>
                          {item.type === 'before_after' ? 'Before/After' : 'Testimonial'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* ── Reviews ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <Text style={styles.sectionCount}>{reviews.length} total</Text>
          </View>

          {reviews.length > 0 && (
            <View style={styles.ratingSummary}>
              <Text style={styles.ratingBig}>{avgRating.toFixed(1)}</Text>
              <View style={{ gap: 4 }}>
                <Stars rating={avgRating} size={20} />
                <Text style={styles.ratingSubtext}>
                  {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}

          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No reviews yet</Text>
            </View>
          ) : (
            reviews.map(review => {
              const revAvatarUrl = review.reviewer_avatar_url
                ? supabase.storage.from('avatars').getPublicUrl(review.reviewer_avatar_url).data.publicUrl
                : null;
              return (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    {revAvatarUrl ? (
                      <Image source={{ uri: revAvatarUrl }} style={styles.reviewerAvatar} />
                    ) : (
                      <View style={[styles.reviewerAvatar, styles.reviewerAvatarFallback]}>
                        <Text style={styles.reviewerInitial}>{review.reviewer_name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.reviewMeta}>
                      <Text style={styles.reviewerName}>{review.reviewer_name}</Text>
                      <View style={styles.reviewMetaRow}>
                        <Stars rating={review.rating} size={12} />
                        <Text style={styles.reviewDate}>{formatDate(review.created_at)}</Text>
                      </View>
                    </View>
                  </View>
                  {review.comment ? (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── Bottom CTA ─────────────────────────────────────────────── */}
      <View style={[styles.ctaBar, { paddingBottom: ctaBottom }]}>
        <TouchableOpacity
          style={[styles.ctaBtn, styles.ctaShortlist, isShortlisted && styles.ctaShortlisted]}
          onPress={handleShortlist}
          disabled={isSaving || isShortlisted}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaShortlistText}>
            {isShortlisted ? '✓ Shortlisted' : isSaving ? 'Saving...' : 'Save to Shortlist'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaBtn, styles.ctaMessage, !isShortlisted && styles.ctaMessageDisabled]}
          onPress={handleMessage}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaMessageText, !isShortlisted && { opacity: 0.45 }]}>Message</Text>
        </TouchableOpacity>
      </View>

      <PortfolioViewer item={viewerItem} onClose={() => setViewerItem(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.xl },

  // Cover
  cover: { height: COVER_HEIGHT, backgroundColor: colors.surface },
  coverFallback: { backgroundColor: colors.surface },
  backBtn: {
    position: 'absolute',
    left: spacing.md,
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  backBtnText: { color: colors.white, fontSize: 22, lineHeight: 26 },
  distancePill: {
    position: 'absolute', right: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 5,
    zIndex: 10,
  },
  distancePillText: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },
  coverIdentity: {
    position: 'absolute', bottom: spacing.lg,
    left: spacing.lg, right: spacing.lg,
    flexDirection: 'row', alignItems: 'center',
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: colors.primary,
    marginRight: spacing.md,
  },
  avatarFallback: {
    backgroundColor: colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: colors.white, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold },
  identityText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  coverName: {
    color: colors.white, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.xs, flexShrink: 1,
  },
  verifiedDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedIcon: { color: colors.white, fontSize: 10, fontWeight: typography.fontWeight.bold },
  coverTagline: { color: colors.gray300, fontSize: typography.fontSize.sm },

  // Badges
  badgesScroll: { paddingVertical: spacing.md },
  badgesContent: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  badge: {
    borderWidth: 1, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md, paddingVertical: 6,
  },
  badgeText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },

  // Layout
  divider: { height: 1, backgroundColor: colors.border },
  section: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { color: colors.white, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold },
  sectionCount: { color: colors.textSecondary, fontSize: typography.fontSize.sm },

  // About
  bioText: {
    color: colors.textSecondary, fontSize: typography.fontSize.sm,
    lineHeight: 22, marginTop: spacing.sm, marginBottom: spacing.md,
  },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  statChip: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  statChipGreen: {
    borderColor: 'rgba(46,204,113,0.4)',
    backgroundColor: 'rgba(46,204,113,0.08)',
  },
  statChipText: { color: colors.textSecondary, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  categoryTag: {
    backgroundColor: 'rgba(46,204,113,0.12)',
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  categoryTagText: { color: colors.primaryLight, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium },

  // Portfolio
  tabsScroll: { marginBottom: spacing.md },
  tabsContent: { gap: spacing.xs },
  tab: {
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium },
  tabTextActive: { color: colors.black, fontWeight: typography.fontWeight.bold },
  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CELL_GAP },
  portfolioCell: {
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: borderRadius.md, overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  portfolioThumb: { width: CELL_SIZE, height: CELL_SIZE },
  playOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  playIcon: { color: colors.white, fontSize: 28 },
  categoryLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 6, paddingVertical: 3,
  },
  categoryLabelText: { color: colors.white, fontSize: 9, fontWeight: typography.fontWeight.semibold },

  // Reviews
  ratingSummary: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, marginBottom: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
  },
  ratingBig: { color: colors.primary, fontSize: typography.fontSize.xxxl, fontWeight: typography.fontWeight.extrabold },
  ratingSubtext: { color: colors.textSecondary, fontSize: typography.fontSize.xs },
  reviewCard: {
    padding: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  reviewerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: spacing.sm },
  reviewerAvatarFallback: { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  reviewerInitial: { color: colors.white, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold },
  reviewMeta: { flex: 1 },
  reviewerName: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, marginBottom: 3 },
  reviewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewDate: { color: colors.textMuted, fontSize: typography.fontSize.xs },
  reviewComment: { color: colors.textSecondary, fontSize: typography.fontSize.sm, lineHeight: 20 },

  // Empty / Error
  emptyState: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: typography.fontSize.sm },
  errorText: { color: colors.error, fontSize: typography.fontSize.base, textAlign: 'center', marginBottom: spacing.md },
  goBackBtn: { backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  goBackText: { color: colors.white, fontWeight: typography.fontWeight.medium },

  // Availability strip
  availNowPill: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.5)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  availNowPillText: { color: '#2ECC71', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },
  unavailPill: {
    backgroundColor: 'rgba(100,100,100,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(100,100,100,0.4)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  unavailPillText: { color: colors.gray500, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium },
  stripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  stripCell: {
    alignItems: 'center',
    gap: 4,
  },
  stripDayName: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'uppercase',
  },
  stripDot: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripDayNum: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  stripLegend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textMuted, fontSize: typography.fontSize.xs },
  responseTimeLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  responseTimeValue: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },

  // CTA bar
  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  ctaBtn: {
    flex: 1, paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaShortlist: { backgroundColor: colors.primary },
  ctaShortlisted: { backgroundColor: colors.primaryDark },
  ctaShortlistText: { color: colors.black, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  ctaMessage: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ctaMessageDisabled: {},
  ctaMessageText: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
});
