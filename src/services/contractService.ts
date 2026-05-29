import { supabase } from './supabase';
import { Contract, ContractStatus, ProjectWithMilestones, RevisionPolicy } from '../types/contract';

export async function getProjectWithMilestones(projectId: string): Promise<ProjectWithMilestones> {
  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .select('id, business_user_id, freelancer_user_id, title, description, status, total_amount')
    .eq('id', projectId)
    .single();

  if (projectErr) throw projectErr;

  const { data: milestones, error: milestonesErr } = await supabase
    .from('milestones')
    .select('id, title, amount, due_date, status, stripe_payment_intent_id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (milestonesErr) throw milestonesErr;

  return { ...project, milestones: milestones ?? [] };
}

export async function getContractByProject(projectId: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface ContractDraft {
  project_id: string;
  business_user_id: string;
  freelancer_user_id: string;
  scope_text: string;
  deliverables: string[];
  revision_policy: RevisionPolicy;
  revision_custom_text?: string | null;
  ip_clause_enabled: boolean;
  confidentiality_enabled: boolean;
}

export async function saveContract(
  draft: ContractDraft,
  existingId?: string,
): Promise<Contract> {
  if (existingId) {
    const { data, error } = await supabase
      .from('contracts')
      .update(draft)
      .eq('id', existingId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('contracts')
    .insert({ ...draft, status: 'draft' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function sendContractForSignature(
  contractId: string,
  conversationId: string,
  senderId: string,
): Promise<void> {
  const now = new Date().toISOString();

  const { error: contractErr } = await supabase
    .from('contracts')
    .update({ status: 'pending_signature', business_signed_at: now })
    .eq('id', contractId);

  if (contractErr) throw contractErr;

  const { data: contract, error: fetchErr } = await supabase
    .from('contracts')
    .select('project_id')
    .eq('id', contractId)
    .single();

  if (fetchErr) throw fetchErr;

  const { error: msgErr } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content: 'Contract sent for signature.',
    message_type: 'contract',
    metadata: {
      contract_id: contractId,
      project_id: contract.project_id,
      status: 'pending_signature',
    },
  });

  if (msgErr) throw msgErr;
}

export async function polishScopeText(scopeText: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('polish-contract', {
    body: { scope_text: scopeText },
  });

  if (error) throw error;
  if (!data?.polished_text) throw new Error('No polished text returned');
  return data.polished_text as string;
}

export async function signContract(
  contractId: string,
  _role: 'freelancer',
  conversationId: string,
  senderId: string,
): Promise<{ activated: boolean }> {
  const now = new Date().toISOString();

  const { data: contract, error: fetchErr } = await supabase
    .from('contracts')
    .select('business_signed_at, project_id')
    .eq('id', contractId)
    .single();

  if (fetchErr) throw fetchErr;

  const bothSigned = !!contract.business_signed_at;
  const newStatus: ContractStatus = bothSigned ? 'active' : 'pending_signature';

  const { error: updateErr } = await supabase
    .from('contracts')
    .update({ freelancer_signed_at: now, status: newStatus })
    .eq('id', contractId);

  if (updateErr) throw updateErr;

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content: bothSigned
      ? 'Contract signed by both parties. Project is now active!'
      : 'Contract signed.',
    message_type: 'system',
    metadata: null,
  });

  if (bothSigned) {
    await activateProject(contract.project_id);
  }

  return { activated: bothSigned };
}

async function activateProject(projectId: string): Promise<void> {
  await supabase
    .from('projects')
    .update({ status: 'active' })
    .eq('id', projectId);

  const { data: milestones } = await supabase
    .from('milestones')
    .select('id, stripe_payment_intent_id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(1);

  const first = milestones?.[0];
  if (first && !first.stripe_payment_intent_id) {
    await supabase.functions.invoke('create-payment-intent', {
      body: { milestone_id: first.id },
    });
  }
}
