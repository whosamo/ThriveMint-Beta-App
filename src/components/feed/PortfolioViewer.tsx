import React from 'react';
import {
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { PortfolioItem } from '../../types/feed';
import { supabase } from '../../services/supabase';
import { colors, typography, spacing } from '../../theme';

interface Props {
  item: PortfolioItem | null;
  onClose: () => void;
}

const { width: W, height: H } = Dimensions.get('window');

export default function PortfolioViewer({ item, onClose }: Props) {
  const visible = item !== null;
  const mediaUrl = item
    ? supabase.storage.from('portfolios').getPublicUrl(item.media_url).data.publicUrl
    : null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {mediaUrl && item?.type === 'video' ? (
          <Video
            source={{ uri: mediaUrl }}
            style={styles.media}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={visible}
            isLooping
            useNativeControls
          />
        ) : mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="contain" />
        ) : (
          <View style={styles.media} />
        )}

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {(item?.title || item?.description) ? (
          <View style={styles.caption}>
            {item?.title ? <Text style={styles.captionTitle}>{item.title}</Text> : null}
            {item?.description ? <Text style={styles.captionBody}>{item.description}</Text> : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: W,
    height: H,
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 18,
  },
  caption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  captionTitle: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 4,
  },
  captionBody: {
    color: colors.gray300,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
});
