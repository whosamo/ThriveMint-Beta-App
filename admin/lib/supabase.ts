import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is required');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

// Service-role client — server-side only. Never import this in client components.
export const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

export const SUPABASE_URL = process.env.SUPABASE_URL;

export function storageUrl(bucket: string, path: string | null): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
