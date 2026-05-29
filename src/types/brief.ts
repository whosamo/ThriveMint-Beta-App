export interface GeneratedBrief {
  title: string;
  summary: string;
  service_category: string;
  deliverables: string[];
  estimated_timeline: string;
  suggested_budget_range: string;
  ideal_freelancer_profile: string;
}

export interface Brief {
  id: string;
  business_user_id: string;
  title: string;
  summary: string;
  service_category: string;
  deliverables: string[];
  timeline: string | null;
  budget_range: string | null;
  ideal_freelancer_profile: string | null;
  created_at: string;
}

export interface BriefInput {
  description: string;
  budget_range?: string;
  timeline?: string;
  location_preference?: 'local_only' | 'open_to_remote';
}

export interface BriefMatchContext {
  service_category: string;
  ideal_freelancer_profile: string;
  brief_title: string;
}
