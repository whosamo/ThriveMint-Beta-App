import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../services/supabase';
import { getConversations } from '../services/messagingService';
import { Conversation } from '../types/messaging';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors, typography, spacing, borderRadius } from '../theme';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatLastMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function lastMessagePreview(conv: Conversation): string {
  const last = conv.last_message;
  if (!last) return 'No messages yet';
  switch (last.message_type) {
    case 'image': return '📷 Photo';
    case 'meeting': return '📅 Meeting scheduled';
    case 'project': return '📋 Project proposal';
    case 'system': return last.content ?? '';
    default: return last.content ?? '';
  }
}

function ConversationRow({ conv, currentUserId, onPress }: {
  conv: Conversation;
  currentUserId: string;
  onPress: () => void;
}) {
  const avatarUrl = conv.other_user.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(conv.other_user.avatar_url).data.publicUrl
    : null;
  const preview = lastMessagePreview(conv);
  const isUnread = conv.unread_count > 0;
  const timeStr = conv.last_message ? formatLastMessageTime(conv.last_message.created_at) : '';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.avatarWrap}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {conv.other_user.full_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {isUnread && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, isUnread && styles.nameUnread]} numberOfLines={1}>
            {conv.other_user.full_name}
          </Text>
          <Text style={styles.time}>{timeStr}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, isUnread && styles.previewUnread]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {conv.unread_count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {conv.unread_count > 99 ? '99+' : conv.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ConversationsListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const data = await getConversations(currentUserId);
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useFocusEffect(
    useCallback(() => {
      if (currentUserId) loadConversations();
    }, [currentUserId, loadConversations]),
  );

  const handlePress = useCallback(
    (conv: Conversation) => {
      navigation.navigate('Chat', {
        conversationId: conv.id,
        otherUserId: conv.other_user.id,
        otherUserName: conv.other_user.full_name,
        otherUserAvatar: conv.other_user.avatar_url,
      });
    },
    [navigation],
  );

  const keyExtractor = useCallback((c: Conversation) => c.id, []);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationRow
        conv={item}
        currentUserId={currentUserId ?? ''}
        onPress={() => handlePress(item)}
      />
    ),
    [currentUserId, handlePress],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>
            Save a freelancer to shortlist and message them to get started.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          onRefresh={loadConversations}
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 72 + spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  unreadDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  rowBody: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginRight: spacing.sm,
  },
  nameUnread: {
    fontWeight: typography.fontWeight.bold,
  },
  time: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preview: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    marginRight: spacing.sm,
  },
  previewUnread: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: colors.black,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
