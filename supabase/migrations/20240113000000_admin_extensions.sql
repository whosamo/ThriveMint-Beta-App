-- ── Admin Extensions ─────────────────────────────────────────────────────────

-- Rejection reason on freelancer_profiles
ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Admin notes on projects (for dispute resolution)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Waitlist emails
CREATE TABLE IF NOT EXISTS public.waitlist_emails (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT        NOT NULL UNIQUE,
  name       TEXT,
  role       TEXT        CHECK (role IN ('business', 'freelancer', 'both')),
  city       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.waitlist_emails ENABLE ROW LEVEL SECURITY;

-- Only service role can read waitlist (admin only)
CREATE POLICY "waitlist: service role only"
  ON public.waitlist_emails FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Public insert for sign-up form
CREATE POLICY "waitlist: anyone can join"
  ON public.waitlist_emails FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_waitlist_created ON public.waitlist_emails(created_at DESC);

-- ── suspended check on verification_status ───────────────────────────────────
-- Allow 'suspended' as a value for freelancer verification_status
ALTER TABLE public.freelancer_profiles
  DROP CONSTRAINT IF EXISTS freelancer_profiles_verification_status_check;

ALTER TABLE public.freelancer_profiles
  ADD CONSTRAINT freelancer_profiles_verification_status_check
  CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended'));
