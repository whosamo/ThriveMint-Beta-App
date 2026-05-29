-- ── reports ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_type      TEXT        NOT NULL CHECK (content_type IN ('profile', 'message', 'portfolio_item')),
  content_id        TEXT,
  reason            TEXT        NOT NULL,
  details           TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON public.reports(reported_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_reporter      ON public.reports(reporter_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports: user can insert own"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "reports: user can view own"
  ON public.reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

-- ── blocks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocks (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks(blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks: user can manage own"
  ON public.blocks FOR ALL TO authenticated
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

-- ── admin_alerts ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  type         TEXT        NOT NULL DEFAULT 'report',
  reference_id TEXT,
  message      TEXT        NOT NULL,
  resolved     BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_type_resolved ON public.admin_alerts(type, resolved, created_at DESC);

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — only service role and admin dashboard access

-- ── notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'system',
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  is_read    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: user can view own"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notifications: user can mark read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── auto-suspend trigger ──────────────────────────────────────────────────────
-- On each new report: insert admin_alert; if 3+ reports in 7 days → suspend + notify user
CREATE OR REPLACE FUNCTION public.handle_new_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Admin alert for every report
  INSERT INTO public.admin_alerts (type, reference_id, message)
  VALUES (
    'report',
    NEW.id::TEXT,
    'New ' || NEW.reason || ' report against user ' || NEW.reported_user_id::TEXT
  );

  -- Count reports in the last 7 days
  SELECT COUNT(*) INTO v_count
  FROM public.reports
  WHERE reported_user_id = NEW.reported_user_id
    AND created_at >= NOW() - INTERVAL '7 days';

  IF v_count >= 3 THEN
    -- Suspend the freelancer profile
    UPDATE public.freelancer_profiles
    SET verification_status = 'suspended'
    WHERE user_id = NEW.reported_user_id
      AND verification_status NOT IN ('suspended', 'banned');

    -- In-app notification to the suspended user
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (
      NEW.reported_user_id,
      'system',
      'Account Temporarily Suspended',
      'Your account has been temporarily suspended pending review. Contact support@thrivemint.com'
    );

    -- Admin alert for the auto-suspension
    INSERT INTO public.admin_alerts (type, reference_id, message)
    VALUES (
      'suspension',
      NEW.reported_user_id::TEXT,
      'Auto-suspended user ' || NEW.reported_user_id::TEXT || ' after ' || v_count || ' reports in 7 days'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_report ON public.reports;
CREATE TRIGGER trg_handle_new_report
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_report();
