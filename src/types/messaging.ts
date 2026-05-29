export type MessageType = 'text' | 'image' | 'meeting' | 'project' | 'system' | 'contract';
export type MeetingType = 'in_person' | 'video_call';
export type MeetingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  file_url: string | null;
  message_type: MessageType;
  is_read: boolean;
  metadata: MeetingMetadata | ProjectMetadata | ContractMetadata | null;
  created_at: string;
}

export interface MeetingMetadata {
  meeting_id: string;
  meeting_type: MeetingType;
  scheduled_at: string;
  status: MeetingStatus;
}

export interface ProjectMetadata {
  project_id: string;
  title: string;
  total_amount: number;
  milestone_count: number;
}

export interface ContractMetadata {
  contract_id: string;
  project_id: string;
  status: 'draft' | 'pending_signature' | 'active';
}

export interface Conversation {
  id: string;
  business_user_id: string;
  freelancer_user_id: string;
  created_at: string;
  other_user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  last_message: {
    content: string | null;
    message_type: MessageType;
    created_at: string;
    sender_id: string;
    is_read: boolean;
  } | null;
  unread_count: number;
}

export interface MilestoneDraft {
  title: string;
  amount: string;
  due_date: string;
}

export interface ProjectDraft {
  title: string;
  description: string;
  total_amount: string;
  milestones: MilestoneDraft[];
}
