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

  try {
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

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { milestone_id } = await req.json() as { milestone_id: string };

    const { data: milestone, error: mErr } = await supabase
      .from('milestones')
      .select('id, amount, title, project_id, stripe_payment_intent_id')
      .eq('id', milestone_id)
      .single();

    if (mErr || !milestone) {
      return new Response(JSON.stringify({ error: 'Milestone not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (milestone.stripe_payment_intent_id) {
      const intent = await stripe.paymentIntents.retrieve(milestone.stripe_payment_intent_id);
      return new Response(
        JSON.stringify({ client_secret: intent.client_secret, payment_intent_id: intent.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const amountCents = Math.round(Number(milestone.amount) * 100);

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: {
        milestone_id: milestone.id,
        project_id: milestone.project_id,
        user_id: user.id,
      },
      description: milestone.title,
    });

    await supabase
      .from('milestones')
      .update({ stripe_payment_intent_id: intent.id })
      .eq('id', milestone.id);

    return new Response(
      JSON.stringify({ client_secret: intent.client_secret, payment_intent_id: intent.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('create-payment-intent error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
