export type ContractStatus = 'draft' | 'pending_signature' | 'active';
export type RevisionPolicy = '1_revision' | '2_revisions' | 'unlimited' | 'custom';

export interface Contract {
  id: string;
  project_id: string;
  business_user_id: string;
  freelancer_user_id: string;
  scope_text: string;
  deliverables: string[];
  revision_policy: RevisionPolicy;
  revision_custom_text: string | null;
  ip_clause_enabled: boolean;
  confidentiality_enabled: boolean;
  business_signed_at: string | null;
  freelancer_signed_at: string | null;
  status: ContractStatus;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  title: string;
  amount: number;
  due_date: string | null;
  status: 'pending' | 'released';
  stripe_payment_intent_id: string | null;
}

export interface ProjectWithMilestones {
  id: string;
  business_user_id: string;
  freelancer_user_id: string;
  title: string;
  description: string;
  status: string;
  total_amount: number;
  milestones: Milestone[];
}
