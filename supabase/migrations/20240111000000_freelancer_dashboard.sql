-- ── Freelancer Dashboard ──────────────────────────────────────────────────────
-- Adds: profile_views tracking, before/after & testimonial columns on
--       portfolio_items, push_token on users.

-- ── portfolio_items extra columns ─────────────────────────────────────────────
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS before_url     TEXT,
  ADD COLUMN IF NOT EXISTS after_url      TEXT,
  ADD COLUMN IF NOT EXISTS client_name    TEXT,
  ADD COLUMN IF NOT EXISTS client_role    TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url  TEXT;

-- ── profile_views ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_views (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  freelancer_id   UUID        NOT NULL REFERENCES public.freelancer_profiles(id) ON DELETE CASCADE,
  viewer_id       UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pv_freelancer_created
  ON public.profile_views (freelancer_id, created_at DESC);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can record a view
CREATE POLICY "profile_views: any authenticated user can insert"
  ON public.profile_views FOR INSERT TO authenticated
  WITH CHECK (true);

-- Freelancers can only read views on their own profile
CREATE POLICY "profile_views: freelancer can see own views"
  ON public.profile_views FOR SELECT TO authenticated
  USING (
    freelancer_id IN (
      SELECT id FROM public.freelancer_profiles WHERE user_id = auth.uid()
    )
  );

-- ── push_token on users ───────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_token TEXT;

-- ── RLS on portfolio_items (freelancer can manage own) ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portfolio_items' AND policyname = 'portfolio_items: freelancer can manage own'
  ) THEN
    CREATE POLICY "portfolio_items: freelancer can manage own"
      ON public.portfolio_items FOR ALL TO authenticated
      USING (
        freelancer_id IN (
          SELECT id FROM public.freelancer_profiles WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        freelancer_id IN (
          SELECT id FROM public.freelancer_profiles WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portfolio_items' AND policyname = 'portfolio_items: anyone authenticated can view'
  ) THEN
    CREATE POLICY "portfolio_items: anyone authenticated can view"
      ON public.portfolio_items FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
