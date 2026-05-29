import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import {
  getProjectWithMilestones,
  getContractByProject,
  saveContract,
  sendContractForSignature,
  polishScopeText,
} from '../services/contractService';
import { RevisionPolicy } from '../types/contract';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

type RouteT = RouteProp<RootStackParamList, 'ContractBuilder'>;

const REVISION_OPTIONS: { label: string; value: RevisionPolicy }[] = [
  { label: '1 Rev', value: '1_revision' },
  { label: '2 Revs', value: '2_revisions' },
  { label: 'Unlimited', value: 'unlimited' },
  { label: 'Custom', value: 'custom' },
];

export default function ContractBuilderScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteT>();
  const { projectId, conversationId } = route.params;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [existingContractId, setExistingContractId] = useState<string | undefined>();
  const [projectTitle, setProjectTitle] = useState('');
  const [freelancerUserId, setFreelancerUserId] = useState('');
  const [businessUserId, setBusinessUserId] = useState('');

  const [scopeText, setScopeText] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [revisionPolicy, setRevisionPolicy] = useState<RevisionPolicy>('1_revision');
  const [revisionCustomText, setRevisionCustomText] = useState('');
  const [ipEnabled, setIpEnabled] = useState(true);
  const [confidentialityEnabled, setConfidentialityEnabled] = useState(true);

  const [loading, setLoading] = useState(true);
  const [polishing, setPolishing] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
        const project = await getProjectWithMilestones(projectId);
        setProjectTitle(project.title);
        setFreelancerUserId(project.freelancer_user_id);
        setBusinessUserId(project.business_user_id);

        const existing = await getContractByProject(projectId);
        if (existing) {
          setExistingContractId(existing.id);
          setScopeText(existing.scope_text);
          setDeliverables(existing.deliverables);
          setRevisionPolicy(existing.revision_policy);
          setRevisionCustomText(existing.revision_custom_text ?? '');
          setIpEnabled(existing.ip_clause_enabled);
          setConfidentialityEnabled(existing.confidentiality_enabled);
        } else {
          setScopeText(project.description);
          setDeliverables(project.milestones.map((m) => m.title).filter(Boolean));
        }
      } catch {
        Alert.alert('Error', 'Failed to load project data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUserId, projectId]);

  const updateDeliverable = useCallback((index: number, text: string) => {
    setDeliverables((prev) => prev.map((d, i) => (i === index ? text : d)));
  }, []);

  const addDeliverable = useCallback(() => {
    setDeliverables((prev) => [...prev, '']);
  }, []);

  const removeDeliverable = useCallback((index: number) => {
    setDeliverables((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePolish = useCallback(async () => {
    if (!scopeText.trim()) return;
    setPolishing(true);
    try {
      const polished = await polishScopeText(scopeText);
      setScopeText(polished);
    } catch {
      Alert.alert('Error', 'AI polish failed. Please try again.');
    } finally {
      setPolishing(false);
    }
  }, [scopeText]);

  const handleSendForSignature = useCallback(async () => {
    if (!currentUserId || !scopeText.trim()) return;
    setSending(true);
    try {
      const contract = await saveContract(
        {
          project_id: projectId,
          business_user_id: businessUserId || currentUserId,
          freelancer_user_id: freelancerUserId,
          scope_text: scopeText,
          deliverables: deliverables.filter((d) => d.trim()),
          revision_policy: revisionPolicy,
          revision_custom_text: revisionCustomText.trim() || null,
          ip_clause_enabled: ipEnabled,
          confidentiality_enabled: confidentialityEnabled,
        },
        existingContractId,
      );
      setExistingContractId(contract.id);
      await sendContractForSignature(contract.id, conversationId, currentUserId);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to send contract. Please try again.');
    } finally {
      setSending(false);
    }
  }, [
    currentUserId, projectId, businessUserId, freelancerUserId, scopeText,
    deliverables, revisionPolicy, revisionCustomText, ipEnabled,
    confidentialityEnabled, existingContractId, conversationId, navigation,
  ]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Contract Builder</Text>
        <TouchableOpacity
          onPress={handlePolish}
          disabled={polishing || !scopeText.trim()}
          style={[styles.polishBtn, (polishing || !scopeText.trim()) && styles.polishBtnDisabled]}
        >
          {polishing ? (
            <ActivityIndicator color={colors.black} size="small" />
          ) : (
            <Text style={styles.polishBtnText}>✦ AI Polish</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.projectBadge}>{projectTitle}</Text>

        <Text style={styles.sectionLabel}>Scope of Work</Text>
        <TextInput
          style={styles.scopeInput}
          value={scopeText}
          onChangeText={setScopeText}
          placeholder="Describe the scope of work…"
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.sectionLabel}>Deliverables</Text>
        {deliverables.map((d, i) => (
          <View key={i} style={styles.deliverableRow}>
            <Text style={styles.bullet}>•</Text>
            <TextInput
              style={styles.deliverableInput}
              value={d}
              onChangeText={(t) => updateDeliverable(i, t)}
              placeholder={`Deliverable ${i + 1}`}
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              onPress={() => removeDeliverable(i)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.removeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addDeliverableBtn} onPress={addDeliverable}>
          <Text style={styles.addDeliverableText}>+ Add Deliverable</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Revision Policy</Text>
        <View style={styles.revisionRow}>
          {REVISION_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.revisionChip,
                revisionPolicy === opt.value && styles.revisionChipActive,
              ]}
              onPress={() => setRevisionPolicy(opt.value)}
            >
              <Text
                style={[
                  styles.revisionChipText,
                  revisionPolicy === opt.value && styles.revisionChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {revisionPolicy === 'custom' && (
          <TextInput
            style={styles.customRevisionInput}
            value={revisionCustomText}
            onChangeText={setRevisionCustomText}
            placeholder="Describe revision terms…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
        )}

        <Text style={styles.sectionLabel}>Clauses</Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleLabel}>IP Rights Transfer</Text>
            <Text style={styles.toggleSub}>
              All work product is owned by the client upon payment.
            </Text>
          </View>
          <Switch
            value={ipEnabled}
            onValueChange={setIpEnabled}
            trackColor={{ false: colors.gray700, true: colors.primaryDark }}
            thumbColor={ipEnabled ? colors.primary : colors.gray400}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleLabel}>Confidentiality (NDA)</Text>
            <Text style={styles.toggleSub}>
              Both parties agree to keep project details private.
            </Text>
          </View>
          <Switch
            value={confidentialityEnabled}
            onValueChange={setConfidentialityEnabled}
            trackColor={{ false: colors.gray700, true: colors.primaryDark }}
            thumbColor={confidentialityEnabled ? colors.primary : colors.gray400}
          />
        </View>

        <Text style={styles.sectionLabel}>Dispute Resolution</Text>
        <View style={styles.staticSection}>
          <Text style={styles.staticText}>
            Any disputes will first be resolved through good-faith negotiation. If unresolved,
            either party may request mediation through ThriveMint's support team. Both parties
            agree to binding arbitration as a final step.
          </Text>
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ This in-app agreement is not a legally binding e-signature. It serves as a mutual
            acknowledgement of the agreed terms within ThriveMint.
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.sendBtn, (sending || !scopeText.trim()) && styles.sendBtnDisabled]}
          onPress={handleSendForSignature}
          disabled={sending || !scopeText.trim()}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator color={colors.black} size="small" />
          ) : (
            <Text style={styles.sendBtnText}>Send for Signature →</Text>
          )}
        </TouchableOpacity>
      </View>
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
  polishBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    minWidth: 104,
    alignItems: 'center',
  },
  polishBtnDisabled: { opacity: 0.4 },
  polishBtnText: {
    color: colors.black,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md },
  projectBadge: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  scopeInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    padding: spacing.md,
    minHeight: 120,
  },
  deliverableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  bullet: {
    color: colors.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  deliverableInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  removeIcon: { color: colors.textMuted, fontSize: 14 },
  addDeliverableBtn: { marginTop: spacing.xs },
  addDeliverableText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  revisionRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  revisionChip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  revisionChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(46,204,113,0.12)',
  },
  revisionChipText: { color: colors.textSecondary, fontSize: typography.fontSize.sm },
  revisionChipTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  customRevisionInput: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    padding: spacing.md,
    minHeight: 80,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  toggleTextWrap: { flex: 1, marginRight: spacing.md },
  toggleLabel: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2,
  },
  toggleSub: { color: colors.textSecondary, fontSize: typography.fontSize.xs },
  staticSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  staticText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
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
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.md,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: {
    color: colors.black,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
