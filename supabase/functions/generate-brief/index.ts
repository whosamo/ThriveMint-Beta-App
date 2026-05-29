import Anthropic from 'npm:@anthropic-ai/sdk@latest';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT =
  "You are a project scoping assistant for ThriveMint, a local freelance marketplace. Given the user's description, generate a structured project brief in JSON with these fields: title, summary (2-3 sentences), service_category, deliverables (array of strings), estimated_timeline, suggested_budget_range, ideal_freelancer_profile (2-3 sentences). Be specific and professional. Return only valid JSON, no markdown.";

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
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

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { description, budget_range, timeline, location_preference } = await req.json();

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'A description of at least 10 characters is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

    const extras: string[] = [];
    if (budget_range) extras.push(`Budget range: ${budget_range}`);
    if (timeline) extras.push(`Desired timeline: ${timeline}`);
    if (location_preference) {
      extras.push(`Location preference: ${location_preference === 'local_only' ? 'Local only' : 'Open to remote'}`);
    }

    const userMessage = extras.length > 0
      ? `${description.trim()}\n\nAdditional context:\n${extras.join('\n')}`
      : description.trim();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    let brief;
    try {
      brief = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        brief = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse structured brief from response.');
      }
    }

    return new Response(JSON.stringify({ brief }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
