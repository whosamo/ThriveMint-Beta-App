import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  // Service-role client for writing system messages and admin alerts
  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { milestone_id, conversation_id } = await req.json() as {
      milestone_id: string;
      conversation_id?: string;
    };

    // Fetch milestone + project + freelancer Stripe account
    const { data: milestone, error: mErr } = await supabase
      .from('milestones')
      .select('id, amount, title, status, project_id')
      .eq('id', milestone_id)
      .single();

    if (mErr || !milestone) {
      return new Response(JSON.stringify({ error: 'Milestone not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (milestone.status === 'released') {
      return new Response(JSON.stringify({ error: 'Milestone already released' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: project, error: pErr } = await supabase
      .from('projects')
      .select('id, business_user_id, freelancer_user_id, title, conversation_id')
      .eq('id', milestone.project_id)
      .single();

    if (pErr || !project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (project.business_user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorised to release this milestone' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up freelancer's connected Stripe account
    const { data: fp } = await supabase
      .from('freelancer_profiles')
      .select('stripe_account_id')
      .eq('user_id', project.freelancer_user_id)
      .maybeSingle();

    const stripeAccountId = fp?.stripe_account_id;
    let transferId: string | null = null;

    if (stripeAccountId) {
      // Create a Stripe Transfer to the freelancer's connected account
      const amountCents = Math.round(Number(milestone.amount) * 100);
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: stripeAccountId,
        description: `Milestone: ${milestone.title} — ${project.title}`,
        metadata: {
          milestone_id: milestone.id,
          project_id: project.id,
          business_user_id: project.business_user_id,
          freelancer_user_id: project.freelancer_user_id,
        },
      });
      transferId = transfer.id;
    }

    // Mark milestone as released
    const { error: updateErr } = await supabase
      .from('milestones')
      .update({ status: 'released' })
      .eq('id', milestone_id);

    if (updateErr) throw updateErr;

    // Check if all milestones are now released → complete the project
    const { data: pendingMilestones } = await supabase
      .from('milestones')
      .select('id')
      .eq('project_id', project.id)
      .eq('status', 'pending');

    if (!pendingMilestones || pendingMilestones.length === 0) {
      await supabase
        .from('projects')
        .update({ status: 'completed' })
        .eq('id', project.id);
    }

    // Send system message to the conversation
    const convId = conversation_id ?? project.conversation_id;
    if (convId) {
      await adminSupabase.from('messages').insert({
        conversation_id: convId,
        sender_id: user.id,
        message_type: 'system',
        content: `✅ Milestone released: "${milestone.title}" ($${Number(milestone.amount).toFixed(2)})`,
      });

      // Notify the freelancer
      const { data: flUser } = await adminSupabase
        .from('users')
        .select('id')
        .eq('id', project.freelancer_user_id)
        .single();

      if (flUser) {
        await adminSupabase.from('notifications').insert({
          user_id: flUser.id,
          type: 'milestone',
          title: 'Milestone payment released',
          body: `"${milestone.title}" ($${Number(milestone.amount).toFixed(2)}) has been released for ${project.title}.`,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, transfer_id: transferId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('release-milestone error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
