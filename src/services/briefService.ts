import { supabase } from './supabase';
import { Brief, BriefInput, GeneratedBrief } from '../types/brief';

export async function generateBrief(input: BriefInput): Promise<GeneratedBrief> {
  const { data, error } = await supabase.functions.invoke('generate-brief', { body: input });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.brief as GeneratedBrief;
}

export async function saveBrief(brief: GeneratedBrief, businessUserId: string): Promise<string> {
  const { data, error } = await supabase
    .from('briefs')
    .insert({
      business_user_id: businessUserId,
      title: brief.title,
      summary: brief.summary,
      service_category: brief.service_category,
      deliverables: brief.deliverables,
      timeline: brief.estimated_timeline ?? null,
      budget_range: brief.suggested_budget_range ?? null,
      ideal_freelancer_profile: brief.ideal_freelancer_profile ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function getSavedBriefs(businessUserId: string): Promise<Brief[]> {
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('business_user_id', businessUserId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Brief[];
}

export async function deleteBrief(briefId: string): Promise<void> {
  const { error } = await supabase.from('briefs').delete().eq('id', briefId);
  if (error) throw error;
}
