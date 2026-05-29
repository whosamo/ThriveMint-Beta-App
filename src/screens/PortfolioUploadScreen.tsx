import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { colors, typography, spacing, borderRadius } from '../theme';

type PortfolioType = 'video' | 'image' | 'before_after' | 'testimonial';

const TYPE_OPTIONS: { value: PortfolioType; label: string; icon: string }[] = [
  { value: 'video', label: 'Video Reel', icon: '🎬' },
  { value: 'image', label: 'Image', icon: '🖼️' },
  { value: 'before_after', label: 'Before & After', icon: '↔️' },
  { value: 'testimonial', label: 'Testimonial', icon: '⭐' },
];

interface UploadProgress {
  active: boolean;
  pct: number;
  label: string;
}

async function uploadMedia(
  uri: string,
  bucket: string,
  path: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  // Expo's fetch-based upload with ArrayBuffer
  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const contentType = ext === 'mp4' || ext === 'mov' ? 'video/mp4' : 'image/jpeg';

  onProgress?.(30);

  const { error, data } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType, upsert: false });

  if (error) throw error;
  onProgress?.(90);

  return data.path;
}

export default function PortfolioUploadScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [type, setType] = useState<PortfolioType>('image');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // single media (video / image)
  const [mediaUri, setMediaUri] = useState<string | null>(null);

  // before & after
  const [beforeUri, setBeforeUri] = useState<string | null>(null);
  const [afterUri, setAfterUri] = useState<string | null>(null);

  // testimonial
  const [clientName, setClientName] = useState('');
  const [clientRole, setClientRole] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [testimonialVideoUri, setTestimonialVideoUri] = useState<string | null>(null);

  const [progress, setProgress] = useState<UploadProgress>({ active: false, pct: 0, label: '' });

  async function pickImage(onPick: (uri: string) => void) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      onPick(result.assets[0].uri);
    }
  }

  async function pickVideo(onPick: (uri: string) => void) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      onPick(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    if (!user) return;

    // Validate
    if (type === 'testimonial') {
      if (!clientName.trim() || !reviewText.trim()) {
        Alert.alert('Missing info', 'Client name and review text are required.');
        return;
      }
    } else if (type === 'before_after') {
      if (!beforeUri || !afterUri) {
        Alert.alert('Missing media', 'Please select both before and after images.');
        return;
      }
    } else {
      if (!mediaUri) {
        Alert.alert('Missing media', 'Please select a file to upload.');
        return;
      }
    }

    // Get freelancer profile id
    setProgress({ active: true, pct: 10, label: 'Preparing…' });

    const { data: fp } = await supabase
      .from('freelancer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!fp?.id) {
      setProgress({ active: false, pct: 0, label: '' });
      Alert.alert('Error', 'Freelancer profile not found.');
      return;
    }

    try {
      const timestamp = Date.now();
      const baseStoragePath = `${user.id}/${timestamp}`;
      let insertPayload: Record<string, any> = {
        freelancer_id: fp.id,
        type,
        title: title.trim() || null,
        description: description.trim() || null,
      };

      if (type === 'video') {
        setProgress({ active: true, pct: 20, label: 'Uploading video…' });
        const path = await uploadMedia(mediaUri!, 'portfolios', `${baseStoragePath}.mp4`, (p) =>
          setProgress({ active: true, pct: 20 + p * 0.7, label: 'Uploading video…' }),
        );
        insertPayload.media_url = path;
      } else if (type === 'image') {
        setProgress({ active: true, pct: 20, label: 'Uploading image…' });
        const path = await uploadMedia(mediaUri!, 'portfolios', `${baseStoragePath}.jpg`, (p) =>
          setProgress({ active: true, pct: 20 + p * 0.7, label: 'Uploading image…' }),
        );
        insertPayload.media_url = path;
      } else if (type === 'before_after') {
        setProgress({ active: true, pct: 20, label: 'Uploading before image…' });
        const beforePath = await uploadMedia(beforeUri!, 'portfolios', `${baseStoragePath}_before.jpg`);
        setProgress({ active: true, pct: 50, label: 'Uploading after image…' });
        const afterPath = await uploadMedia(afterUri!, 'portfolios', `${baseStoragePath}_after.jpg`);
        insertPayload.before_url = beforePath;
        insertPayload.after_url = afterPath;
        insertPayload.media_url = afterPath; // primary thumbnail = after
      } else if (type === 'testimonial') {
        insertPayload.client_name = clientName.trim();
        insertPayload.client_role = clientRole.trim() || null;
        insertPayload.description = reviewText.trim();
        if (testimonialVideoUri) {
          setProgress({ active: true, pct: 20, label: 'Uploading testimonial video…' });
          const path = await uploadMedia(testimonialVideoUri!, 'portfolios', `${baseStoragePath}_testimonial.mp4`, (p) =>
            setProgress({ active: true, pct: 20 + p * 0.7, label: 'Uploading testimonial video…' }),
          );
          insertPayload.media_url = path;
        }
      }

      setProgress({ active: true, pct: 92, label: 'Saving…' });

      const { error } = await supabase.from('portfolio_items').insert(insertPayload);
      if (error) throw error;

      setProgress({ active: false, pct: 0, label: '' });
      Alert.alert('Done!', 'Your portfolio item has been uploaded.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      setProgress({ active: false, pct: 0, label: '' });
      Alert.alert('Upload failed', err.message ?? 'Something went wrong. Please try again.');
    }
  }

  const canSubmit = !progress.active && (
    type === 'testimonial'
      ? clientName.trim().length > 0 && reviewText.trim().length > 0
      : type === 'before_after'
      ? !!beforeUri && !!afterUri
      : !!mediaUri
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Content</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Type selector */}
        <Text style={styles.sectionLabel}>Content Type</Text>
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.typeBtn, type === opt.value && styles.typeBtnActive]}
              onPress={() => setType(opt.value)}
              activeOpacity={0.75}
            >
              <Text style={styles.typeIcon}>{opt.icon}</Text>
              <Text style={[styles.typeLabel, type === opt.value && styles.typeLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Media pickers */}
        {type === 'video' && (
          <View style={styles.mediaPicker}>
            <TouchableOpacity style={styles.mediaBox} onPress={() => pickVideo(setMediaUri)} activeOpacity={0.75}>
              {mediaUri ? (
                <Text style={styles.mediaSelected}>✓ Video selected</Text>
              ) : (
                <>
                  <Text style={styles.mediaBoxIcon}>🎬</Text>
                  <Text style={styles.mediaBoxLabel}>Tap to select video</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {type === 'image' && (
          <View style={styles.mediaPicker}>
            <TouchableOpacity style={styles.mediaBox} onPress={() => pickImage(setMediaUri)} activeOpacity={0.75}>
              {mediaUri ? (
                <Image source={{ uri: mediaUri }} style={styles.previewImage} resizeMode="cover" />
              ) : (
                <>
                  <Text style={styles.mediaBoxIcon}>🖼️</Text>
                  <Text style={styles.mediaBoxLabel}>Tap to select image</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {type === 'before_after' && (
          <View style={styles.beforeAfterRow}>
            <TouchableOpacity
              style={[styles.halfMediaBox, { marginRight: spacing.sm }]}
              onPress={() => pickImage(setBeforeUri)}
              activeOpacity={0.75}
            >
              {beforeUri ? (
                <Image source={{ uri: beforeUri }} style={styles.halfPreview} resizeMode="cover" />
              ) : (
                <>
                  <Text style={styles.mediaBoxIcon}>📷</Text>
                  <Text style={styles.mediaBoxLabel}>Before</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.halfMediaBox}
              onPress={() => pickImage(setAfterUri)}
              activeOpacity={0.75}
            >
              {afterUri ? (
                <Image source={{ uri: afterUri }} style={styles.halfPreview} resizeMode="cover" />
              ) : (
                <>
                  <Text style={styles.mediaBoxIcon}>✨</Text>
                  <Text style={styles.mediaBoxLabel}>After</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {type === 'testimonial' && (
          <View style={styles.testimonialForm}>
            <Text style={styles.fieldLabel}>Client Name *</Text>
            <TextInput
              style={styles.input}
              value={clientName}
              onChangeText={setClientName}
              placeholder="e.g. Sarah Johnson"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Their Role / Company</Text>
            <TextInput
              style={styles.input}
              value={clientRole}
              onChangeText={setClientRole}
              placeholder="e.g. CEO at Bloom Studio"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Review Text *</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="What did they say about working with you?"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
            />
            <Text style={styles.fieldLabel}>Video (optional)</Text>
            <TouchableOpacity
              style={styles.mediaBoxSmall}
              onPress={() => pickVideo(setTestimonialVideoUri)}
              activeOpacity={0.75}
            >
              <Text style={styles.mediaBoxLabel}>
                {testimonialVideoUri ? '✓ Video selected' : '+ Add video testimonial'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Common fields */}
        {type !== 'testimonial' && (
          <>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Give this a title (optional)"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tell clients about this work (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </>
        )}

        {/* Upload progress */}
        {progress.active && (
          <View style={styles.progressBox}>
            <Text style={styles.progressLabel}>{progress.label}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress.pct}%` as any }]} />
            </View>
            <Text style={styles.progressPct}>{Math.round(progress.pct)}%</Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>
            {progress.active ? 'Uploading…' : 'Upload'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    color: colors.textSecondary,
    fontSize: 18,
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 80,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  typeBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  typeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(46,204,113,0.10)',
  },
  typeIcon: { fontSize: 22 },
  typeLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  typeLabelActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  mediaPicker: { marginBottom: spacing.lg },
  mediaBox: {
    height: 160,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mediaBoxSmall: {
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  mediaBoxIcon: { fontSize: 32, marginBottom: spacing.xs },
  mediaBoxLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  mediaSelected: {
    fontSize: typography.fontSize.base,
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  beforeAfterRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  halfMediaBox: {
    flex: 1,
    height: 140,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  halfPreview: {
    width: '100%',
    height: '100%',
  },
  testimonialForm: { marginBottom: spacing.sm },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  inputMulti: {
    height: 96,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  progressBox: {
    marginVertical: spacing.md,
    gap: spacing.xs,
  },
  progressLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressPct: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitText: {
    color: colors.black,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
