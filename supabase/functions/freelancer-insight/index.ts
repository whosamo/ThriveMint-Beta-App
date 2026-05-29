import Anthropic from 'npm:@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { stats, profile } = await req.json();

    const prompt = `You are a helpful coach for freelancers on the ThriveMint platform.

Freelancer profile:
- Services: ${(profile.serviceCategories ?? []).join(', ') || 'not set'}
- Bio: ${profile.bio ? `"${profile.bio.slice(0, 120)}"` : 'not set'}
- Hourly rate: ${profile.hourlyRate ? `$${profile.hourlyRate}/hr` : 'not set'}

This week's stats:
- Profile views: ${stats.profileViewsWeek ?? 0}
- Times shortlisted: ${stats.shortlistCount ?? 0}
- Active projects: ${stats.activeProjects ?? 0}
- Portfolio items: ${stats.portfolioCount ?? 0}

Give ONE short, actionable, personalized tip (max 20 words) to help this freelancer get more clients on ThriveMint. Return only the tip text — no preamble, no quotes.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }],
    });

    const tip = (response.content[0] as { type: string; text: string }).text.trim();

    return new Response(JSON.stringify({ tip }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('freelancer-insight error:', err);
    return new Response(JSON.stringify({ error: 'Failed to generate insight' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
