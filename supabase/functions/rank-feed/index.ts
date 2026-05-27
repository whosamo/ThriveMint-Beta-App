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
    const { items } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ rankedIds: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const profiles = items.map((item: any) => ({
      id: item.freelancer_id,
      name: item.full_name,
      bio: item.bio ?? '',
      categories: item.service_categories ?? [],
      rate: item.hourly_rate,
      availability: item.availability,
      distance_miles: item.distance_miles,
      has_video: item.portfolio_media_type === 'video',
    }));

    const prompt = `You are a recommendation engine for ThriveMint, a platform connecting businesses with local freelancers.

Rank the following freelancer profiles from most to least engaging/relevant. Prioritize:
1. Has a video portfolio (signals high engagement)
2. Relevant and diverse service categories
3. Active availability (full_time or part_time over contract)
4. Shorter distance when available
5. Competitive hourly rate

Freelancers (JSON):
${JSON.stringify(profiles, null, 2)}

Return ONLY a valid JSON array of the freelancer id strings in ranked order, with no explanation.
Example: ["id1","id2","id3"]`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    const match = text.match(/\[[\s\S]*\]/);
    const rankedIds: string[] = match ? JSON.parse(match[0]) : items.map((i: any) => i.freelancer_id);

    return new Response(JSON.stringify({ rankedIds }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('rank-feed error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
