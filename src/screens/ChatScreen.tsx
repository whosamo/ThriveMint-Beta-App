import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase';
import {
  getMessages,
  markMessagesRead,
  sendMessage,
  uploadAttachment,
  scheduleMeeting,
  createProject,
  getOrCreateConversation,
} from '../services/messagingService';
import { Message, ProjectDraft } from '../types/messaging';
import { RootStackParamList } from '../navigation/RootNavigator';
import MessageBubble from '../components/messaging/MessageBubble';
import MeetingSchedulerModal from '../components/messaging/MeetingSchedulerModal';
import ProjectModal from '../components/messaging/ProjectModal';
import { colors, typography, spacing, borderRadius } from '../theme';

type RouteT = RouteProp<RootStackParamList, 'Chat'>;

const PAGE_SIZE = 30;

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteT>();
  const { conversationId, otherUserId, otherUserName, otherUserAvatar } = route.params;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // resolve current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  // initial load
  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
        const data = await getMessages(conversationId, PAGE_SIZE);
        setMessages(data);
        setHasMore(data.length === PAGE_SIZE);
        await markMessagesRead(conversationId, currentUserId);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoadingInitial(false);
      }
    })();
  }, [conversationId, currentUserId]);

  // realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [newMsg, ...prev];
          });
          if (currentUserId && newMsg.sender_id !== currentUserId) {
            markMessagesRead(conversationId, currentUserId).catch(console.error);
          }
        },
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    const oldest = messages[messages.length - 1];
    setLoadingMore(true);
    try {
      const older = await getMessages(conversationId, PAGE_SIZE, oldest.created_at);
      if (older.length === 0) {
        setHasMore(false);
      } else {
        setMessages((prev) => [...prev, ...older]);
        setHasMore(older.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, messages, conversationId]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !currentUserId || sending) return;
    setInputText('');
    setSending(true);
    try {
      await sendMessage(conversationId, currentUserId, text, 'text');
    } catch {
      Alert.alert('Error', 'Message failed to send.');
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [inputText, currentUserId, sending, conversationId]);

  const handleAttach = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to send images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0] || !currentUserId) return;
    setSending(true);
    try {
      const uri = result.assets[0].uri;
      const path = await uploadAttachment(uri);
      const { data } = supabase.storage.from('attachments').getPublicUrl(path);
      await sendMessage(conversationId, currentUserId, null, 'image', null, data.publicUrl);
    } catch {
      Alert.alert('Error', 'Failed to send image.');
    } finally {
      setSending(false);
    }
  }, [currentUserId, conversationId]);

  const handleScheduleMeeting = useCallback(
    async (params: { meetingType: any; scheduledAt: string; title?: string }) => {
      if (!currentUserId) return;
      await scheduleMeeting({
        conversationId,
        organizerId: currentUserId,
        attendeeId: otherUserId,
        ...params,
      });
    },
    [conversationId, currentUserId, otherUserId],
  );

  const handleCreateProject = useCallback(
    async (draft: ProjectDraft) => {
      if (!currentUserId) return;
      await createProject(draft, conversationId, currentUserId, otherUserId);
    },
    [conversationId, currentUserId, otherUserId],
  );

  const avatarUrl = useMemo(
    () =>
      otherUserAvatar
        ? supabase.storage.from('avatars').getPublicUrl(otherUserAvatar).data.publicUrl
        : null,
    [otherUserAvatar],
  );

  const keyExtractor = useCallback((m: Message) => m.id, []);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        message={item}
        isMine={item.sender_id === currentUserId}
        currentUserId={currentUserId ?? ''}
      />
    ),
    [currentUserId],
  );

  const ListFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadMoreSpinner}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }, [loadingMore]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
        ) : (
          <View style={styles.headerAvatarPlaceholder}>
            <Text style={styles.headerAvatarInitial}>
              {otherUserName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerName} numberOfLines={1}>{otherUserName}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => setShowMeetingModal(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.headerActionIcon}>📅</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => setShowProjectModal(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.headerActionIcon}>📋</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 60}
      >
        {loadingInitial ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            inverted
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={ListFooter}
            removeClippedSubviews
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={7}
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={handleAttach}
            disabled={sending}
          >
            <Text style={styles.attachIcon}>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator color={colors.black} size="small" />
            ) : (
              <Text style={styles.sendIcon}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <MeetingSchedulerModal
        visible={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        onSchedule={handleScheduleMeeting}
      />

      <ProjectModal
        visible={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        onSubmit={handleCreateProject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    minHeight: 56,
  },
  backBtn: {
    marginRight: spacing.sm,
  },
  backIcon: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: typography.fontWeight.medium,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: spacing.sm,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerAvatarInitial: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerName: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  headerAction: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  headerActionIcon: {
    fontSize: 22,
  },
  messageList: {
    paddingVertical: spacing.sm,
  },
  loadMoreSpinner: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  attachBtn: {
    paddingBottom: 10,
    paddingRight: spacing.xs,
  },
  attachIcon: {
    fontSize: 22,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.fontSize.base,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    backgroundColor: colors.gray700,
  },
  sendIcon: {
    color: colors.black,
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
  },
});
