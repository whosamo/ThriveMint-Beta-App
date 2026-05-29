import { supabase } from './supabase';
import { Message, Conversation, MeetingType, ProjectDraft } from '../types/messaging';

export async function getOrCreateConversation(
  businessUserId: string,
  freelancerUserId: string,
): Promise<string> {
  const { data: existing, error: fetchErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('business_user_id', businessUserId)
    .eq('freelancer_user_id', freelancerUserId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (existing) return existing.id;

  const { data: created, error: createErr } = await supabase
    .from('conversations')
    .insert({ business_user_id: businessUserId, freelancer_user_id: freelancerUserId })
    .select('id')
    .single();

  if (createErr) throw createErr;
  return created.id;
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data: convRows, error: convErr } = await supabase
    .from('conversations')
    .select('id, business_user_id, freelancer_user_id, created_at')
    .or(`business_user_id.eq.${userId},freelancer_user_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (convErr) throw convErr;
  if (!convRows || convRows.length === 0) return [];

  const otherUserIds = convRows.map((c) =>
    c.business_user_id === userId ? c.freelancer_user_id : c.business_user_id,
  );

  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .in('id', otherUserIds);

  if (usersErr) throw usersErr;

  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  const { data: lastMsgs, error: msgsErr } = await supabase
    .from('messages')
    .select('conversation_id, content, message_type, created_at, sender_id, is_read')
    .in(
      'conversation_id',
      convRows.map((c) => c.id),
    )
    .order('created_at', { ascending: false });

  if (msgsErr) throw msgsErr;

  const lastMsgMap = new Map<string, (typeof lastMsgs)[0]>();
  for (const msg of lastMsgs ?? []) {
    if (!lastMsgMap.has(msg.conversation_id)) {
      lastMsgMap.set(msg.conversation_id, msg);
    }
  }

  const unreadCounts = new Map<string, number>();
  for (const msg of lastMsgs ?? []) {
    if (!msg.is_read && msg.sender_id !== userId) {
      unreadCounts.set(
        msg.conversation_id,
        (unreadCounts.get(msg.conversation_id) ?? 0) + 1,
      );
    }
  }

  return convRows.map((c) => {
    const otherUserId = c.business_user_id === userId ? c.freelancer_user_id : c.business_user_id;
    const otherUser = userMap.get(otherUserId);
    const last = lastMsgMap.get(c.id);
    return {
      id: c.id,
      business_user_id: c.business_user_id,
      freelancer_user_id: c.freelancer_user_id,
      created_at: c.created_at,
      other_user: {
        id: otherUserId,
        full_name: otherUser?.full_name ?? 'Unknown',
        avatar_url: otherUser?.avatar_url ?? null,
      },
      last_message: last
        ? {
            content: last.content,
            message_type: last.message_type as Message['message_type'],
            created_at: last.created_at,
            sender_id: last.sender_id,
            is_read: last.is_read,
          }
        : null,
      unread_count: unreadCounts.get(c.id) ?? 0,
    };
  });
}

export async function getMessages(
  conversationId: string,
  limit = 30,
  before?: string,
): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, file_url, message_type, is_read, metadata, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string | null,
  messageType: Message['message_type'] = 'text',
  metadata?: Message['metadata'],
  fileUrl?: string | null,
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: messageType,
      metadata: metadata ?? null,
      file_url: fileUrl ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}

export async function markMessagesRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .eq('is_read', false)
    .neq('sender_id', userId);

  if (error) throw error;
}

export async function uploadAttachment(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `chat/${fileName}`;

  const { error } = await supabase.storage
    .from('attachments')
    .upload(path, blob, { upsert: false });

  if (error) throw error;
  return path;
}

export async function scheduleMeeting(params: {
  conversationId: string;
  organizerId: string;
  attendeeId: string;
  meetingType: MeetingType;
  scheduledAt: string;
  title?: string;
}): Promise<string> {
  const { data: meeting, error: meetErr } = await supabase
    .from('scheduled_meetings')
    .insert({
      conversation_id: params.conversationId,
      organizer_id: params.organizerId,
      attendee_id: params.attendeeId,
      meeting_type: params.meetingType,
      scheduled_at: params.scheduledAt,
      title: params.title ?? null,
    })
    .select('id')
    .single();

  if (meetErr) throw meetErr;

  await sendMessage(
    params.conversationId,
    params.organizerId,
    null,
    'meeting',
    {
      meeting_id: meeting.id,
      meeting_type: params.meetingType,
      scheduled_at: params.scheduledAt,
      status: 'pending',
    },
  );

  return meeting.id;
}

export async function createProject(
  draft: ProjectDraft,
  conversationId: string,
  businessUserId: string,
  freelancerUserId: string,
): Promise<string> {
  const totalAmount = parseFloat(draft.total_amount);

  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({
      business_user_id: businessUserId,
      freelancer_user_id: freelancerUserId,
      title: draft.title,
      description: draft.description,
      total_amount: totalAmount,
      status: 'pending',
    })
    .select('id')
    .single();

  if (projErr) throw projErr;

  if (draft.milestones.length > 0) {
    const milestoneRows = draft.milestones.map((m) => ({
      project_id: project.id,
      title: m.title,
      amount: parseFloat(m.amount),
      due_date: m.due_date || null,
      status: 'pending',
    }));

    const { error: milestonesErr } = await supabase.from('milestones').insert(milestoneRows);
    if (milestonesErr) throw milestonesErr;
  }

  await sendMessage(
    conversationId,
    businessUserId,
    null,
    'project',
    {
      project_id: project.id,
      title: draft.title,
      total_amount: totalAmount,
      milestone_count: draft.milestones.length,
    },
  );

  return project.id;
}

export async function confirmMeeting(meetingId: string): Promise<void> {
  const { error } = await supabase
    .from('scheduled_meetings')
    .update({ status: 'confirmed' })
    .eq('id', meetingId);

  if (error) throw error;

  const { data: msgs } = await supabase
    .from('messages')
    .select('id, metadata')
    .eq('message_type', 'meeting');

  if (msgs) {
    for (const msg of msgs) {
      const meta = msg.metadata as { meeting_id?: string } | null;
      if (meta?.meeting_id === meetingId) {
        await supabase
          .from('messages')
          .update({ metadata: { ...meta, status: 'confirmed' } })
          .eq('id', msg.id);
        break;
      }
    }
  }
}
