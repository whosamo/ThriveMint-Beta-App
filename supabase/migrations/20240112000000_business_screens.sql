-- ── Business Screens ─────────────────────────────────────────────────────────
-- Adds: stripe_account_id on freelancer_profiles (for Stripe Connect transfers)
--       conversation_id on projects (for easy chat shortcut lookup)

ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- Link a project to its primary conversation (set on project creation)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_conversation ON public.projects(conversation_id);

-- ── RLS: ensure milestones can be released (business updates to 'released') ──
-- The existing policy already allows participants to update milestones.
-- Add an explicit business-only release policy as a safety guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'milestones' AND policyname = 'mile: business can release milestone'
  ) THEN
    CREATE POLICY "mile: business can release milestone"
      ON public.milestones FOR UPDATE TO authenticated
      USING (
        project_id IN (
          SELECT id FROM public.projects WHERE business_user_id = auth.uid()
        )
      )
      WITH CHECK (
        project_id IN (
          SELECT id FROM public.projects WHERE business_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── Disputes: project status can become 'disputed' ──────────────────────────
-- The existing status CHECK already includes 'disputed', so no schema change needed.
-- Just ensure businesses can update project status.
-- (already covered by "proj: participants can update" policy)

-- ── admin_alerts: ensure service role can insert (for edge functions) ────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_alerts' AND policyname = 'admin_alerts: service role insert'
  ) THEN
    CREATE POLICY "admin_alerts: service role insert"
      ON public.admin_alerts FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;
END $$;
