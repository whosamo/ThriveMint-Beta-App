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
import { supabase } from '../services/supabase';
import { signContract } from '../services/contractService';
import { Contract } from '../types/contract';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

type RouteT = RouteProp<RootStackParamList, 'ContractReview'>;

const REVISION_LABEL: Record<string, string> = {
  '1_revision': '1 Revision',
  '2_revisions': '2 Revisions',
  unlimited: 'Unlimited Revisions',
  custom: 'Custom',
};

export default function ContractReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteT>();
  const { contractId, conversationId } = route.params;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('contracts')
          .select('*')
          .eq('id', contractId)
          .single();
        if (error) throw error;
        setContract(data as Contract);
      } catch {
        Alert.alert('Error', 'Failed to load contract.');
      } finally {
        setLoading(false);
      }
    })();
  }, [contractId]);

  const handleSign = useCallback(() => {
    if (!currentUserId || !contract) return;
    Alert.alert(
      'Sign Contract',
      'By agreeing, you acknowledge the terms of this contract. This is an in-app confirmation, not a legally binding e-signature.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign & Agree',
          onPress: async () => {
            setSigning(true);
            try {
              const { activated } = await signContract(
                contractId,
                'freelancer',
                conversationId,
                currentUserId,
              );
              if (activated) {
                Alert.alert(
                  'Project Active!',
                  'Both parties have signed. The project is now active.',
                  [{ text: 'OK', onPress: () => navigation.goBack() }],
                );
              } else {
                Alert.alert('Signed', 'Your signature has been recorded.', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              }
            } catch {
              Alert.alert('Error', 'Failed to sign contract. Please try again.');
            } finally {
              setSigning(false);
            }
          },
        },
      ],
    );
  }, [currentUserId, contract, contractId, conversationId, navigation]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!contract) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Contract not found.</Text>
      </View>
    );
  }

  const alreadySigned = !!contract.freelancer_signed_at;
  const canSign =
    !alreadySigned &&
    contract.status === 'pending_signature' &&
    currentUserId === contract.freelancer_user_id;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Contract</Text>
        <View style={[styles.statusBadge, contract.status === 'active' && styles.statusBadgeActive]}>
          <Text style={[styles.statusText, contract.status === 'active' && styles.statusTextActive]}>
            {contract.status === 'active'
              ? 'Active'
              : contract.status === 'pending_signature'
              ? 'Pending'
              : 'Draft'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Scope of Work</Text>
        <View style={styles.textBlock}>
          <Text style={styles.bodyText}>{contract.scope_text}</Text>
        </View>

        {contract.deliverables.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Deliverables</Text>
            <View style={styles.textBlock}>
              {contract.deliverables.map((d, i) => (
                <Text key={i} style={styles.deliverableItem}>
                  • {d}
                </Text>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>Revision Policy</Text>
        <View style={styles.textBlock}>
          <Text style={styles.bodyText}>
            {REVISION_LABEL[contract.revision_policy] ?? contract.revision_policy}
            {contract.revision_policy === 'custom' && contract.revision_custom_text
              ? `: ${contract.revision_custom_text}`
              : ''}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Clauses</Text>
        <View style={styles.textBlock}>
          {contract.ip_clause_enabled && (
            <Text style={styles.clauseItem}>
              ✓ IP Rights Transfer — All work product is owned by the client upon payment.
            </Text>
          )}
          {contract.confidentiality_enabled && (
            <Text style={styles.clauseItem}>
              ✓ Confidentiality (NDA) — Both parties agree to keep project details private.
            </Text>
          )}
          {!contract.ip_clause_enabled && !contract.confidentiality_enabled && (
            <Text style={styles.bodyText}>No additional clauses.</Text>
          )}
        </View>

        <Text style={styles.sectionLabel}>Dispute Resolution</Text>
        <View style={styles.textBlock}>
          <Text style={styles.bodyText}>
            Any disputes will first be resolved through good-faith negotiation. If unresolved,
            either party may request mediation through ThriveMint's support team. Both parties
            agree to binding arbitration as a final step.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Signatures</Text>
        <View style={styles.signaturesBlock}>
          <View style={styles.signatureRow}>
            <Text style={styles.signatureRole}>Business</Text>
            <Text
              style={[
                styles.signatureStatus,
                contract.business_signed_at ? styles.signedStatus : styles.pendingStatus,
              ]}
            >
              {contract.business_signed_at
                ? `Signed ${new Date(contract.business_signed_at).toLocaleDateString()}`
                : 'Pending'}
            </Text>
          </View>
          <View style={styles.signatureDivider} />
          <View style={styles.signatureRow}>
            <Text style={styles.signatureRole}>Freelancer</Text>
            <Text
              style={[
                styles.signatureStatus,
                contract.freelancer_signed_at ? styles.signedStatus : styles.pendingStatus,
              ]}
            >
              {contract.freelancer_signed_at
                ? `Signed ${new Date(contract.freelancer_signed_at).toLocaleDateString()}`
                : 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ This in-app agreement is not a legally binding e-signature. It serves as a mutual
            acknowledgement of the agreed terms within ThriveMint.
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {canSign && (
        <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.signBtn, signing && styles.signBtnDisabled]}
            onPress={handleSign}
            disabled={signing}
            activeOpacity={0.85}
          >
            {signing ? (
              <ActivityIndicator color={colors.black} size="small" />
            ) : (
              <Text style={styles.signBtnText}>Sign & Agree</Text>
            )}
          </TouchableOpacity>
        </View>
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
    borderColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusBadgeActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(46,204,113,0.12)',
  },
  statusText: {
    color: colors.warning,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  statusTextActive: { color: colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md },
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
  deliverableItem: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    lineHeight: 24,
  },
  clauseItem: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  signaturesBlock: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  signatureDivider: { height: 1, backgroundColor: colors.border },
  signatureRole: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  signatureStatus: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  signedStatus: { color: colors.primary },
  pendingStatus: { color: colors.textMuted },
  disclaimer: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(243,156,18,0.10)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
  },
  disclaimerText: { color: colors.warning, fontSize: typography.fontSize.xs, lineHeight: 18 },
  cta: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  signBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.md,
  },
  signBtnDisabled: { opacity: 0.5 },
  signBtnText: {
    color: colors.black,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
