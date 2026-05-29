-- ── availability table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.availability (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  freelancer_user_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date                 DATE        NOT NULL,
  status               TEXT        NOT NULL CHECK (status IN ('available', 'busy', 'partial')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (freelancer_user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_availability_user_date ON public.availability(freelancer_user_id, date);

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability: authenticated can view"
  ON public.availability FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "availability: freelancer can insert"
  ON public.availability FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = freelancer_user_id);

CREATE POLICY "availability: freelancer can update"
  ON public.availability FOR UPDATE
  TO authenticated
  USING (auth.uid() = freelancer_user_id)
  WITH CHECK (auth.uid() = freelancer_user_id);

CREATE POLICY "availability: freelancer can delete"
  ON public.availability FOR DELETE
  TO authenticated
  USING (auth.uid() = freelancer_user_id);

-- ── Add availability settings to freelancer_profiles ─────────────────────────
ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS accepting_new_work    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS typical_response_time TEXT    NOT NULL DEFAULT 'within_48_hours'
    CHECK (typical_response_time IN ('within_1_hour', 'same_day', 'within_48_hours', 'within_a_week'));
