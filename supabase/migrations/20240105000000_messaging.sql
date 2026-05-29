-- ── messages: add messaging fields ──────────────────────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT    NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS is_read      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata     JSONB;

DO $$ BEGIN
  ALTER TABLE public.messages
    ADD CONSTRAINT messages_type_check
    CHECK (message_type IN ('text', 'image', 'meeting', 'project', 'system'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Relax the old NOT NULL check so meeting/project messages don't need content
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_check
  CHECK (content IS NOT NULL OR file_url IS NOT NULL OR metadata IS NOT NULL);

-- Allow participants to mark messages as read
CREATE POLICY "msg: participants can update read status"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE  c.id = conversation_id
        AND (c.business_user_id = auth.uid() OR c.freelancer_user_id = auth.uid())
    )
  );

-- Composite index for fast paginated message loading
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages (conversation_id, created_at DESC);

-- ── scheduled_meetings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduled_meetings (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  organizer_id    UUID        NOT NULL REFERENCES public.users(id),
  attendee_id     UUID        NOT NULL REFERENCES public.users(id),
  meeting_type    TEXT        NOT NULL CHECK (meeting_type IN ('in_person', 'video_call')),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  title           TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.scheduled_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mtg: participants can view"
  ON public.scheduled_meetings FOR SELECT
  TO authenticated
  USING (auth.uid() = organizer_id OR auth.uid() = attendee_id);

CREATE POLICY "mtg: organizer can create"
  ON public.scheduled_meetings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "mtg: participants can update status"
  ON public.scheduled_meetings FOR UPDATE
  TO authenticated
  USING     (auth.uid() = organizer_id OR auth.uid() = attendee_id)
  WITH CHECK (auth.uid() = organizer_id OR auth.uid() = attendee_id);

CREATE INDEX IF NOT EXISTS idx_meetings_conversation
  ON public.scheduled_meetings (conversation_id);

-- ── fix get_feed_items: pi.type not pi.media_type ────────────────────────────
CREATE OR REPLACE FUNCTION get_feed_items(
  p_user_id   UUID,
  p_offset    INTEGER DEFAULT 0,
  p_limit     INTEGER DEFAULT 10
)
RETURNS TABLE (
  freelancer_id         UUID,
  user_id               UUID,
  full_name             TEXT,
  avatar_url            TEXT,
  city                  TEXT,
  state                 TEXT,
  lat                   DOUBLE PRECISION,
  lng                   DOUBLE PRECISION,
  bio                   TEXT,
  hourly_rate           NUMERIC,
  availability          TEXT,
  service_categories    TEXT[],
  verification_status   TEXT,
  portfolio_media_url   TEXT,
  portfolio_media_type  TEXT,
  portfolio_title       TEXT,
  portfolio_description TEXT,
  distance_miles        DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lat           DOUBLE PRECISION;
  v_lng           DOUBLE PRECISION;
  v_radius        INTEGER;
  v_service_prefs TEXT[];
BEGIN
  SELECT u.lat, u.lng, u.radius_preference_miles, bp.service_preferences
    INTO v_lat, v_lng, v_radius, v_service_prefs
    FROM public.users u
    LEFT JOIN public.business_profiles bp ON bp.user_id = u.id
   WHERE u.id = p_user_id;

  RETURN QUERY
  WITH best_media AS (
    SELECT DISTINCT ON (fp.id)
      fp.id        AS fp_id,
      pi.media_url,
      pi.type      AS media_type,   -- fixed: was pi.media_type
      pi.title,
      pi.description
    FROM public.freelancer_profiles fp
    LEFT JOIN public.portfolio_items pi ON pi.freelancer_id = fp.id
    ORDER BY
      fp.id,
      CASE pi.type WHEN 'video' THEN 0 ELSE 1 END,
      pi.created_at DESC
  )
  SELECT
    fp.id                          AS freelancer_id,
    u.id                           AS user_id,
    u.full_name,
    u.avatar_url,
    u.city,
    u.state,
    u.lat::DOUBLE PRECISION,
    u.lng::DOUBLE PRECISION,
    fp.bio,
    fp.hourly_rate,
    fp.availability::TEXT,
    fp.service_categories,
    fp.verification_status::TEXT,
    bm.media_url                   AS portfolio_media_url,
    bm.media_type                  AS portfolio_media_type,
    bm.title                       AS portfolio_title,
    bm.description                 AS portfolio_description,
    CASE
      WHEN v_lat IS NOT NULL
       AND v_lng IS NOT NULL
       AND u.lat  IS NOT NULL
       AND u.lng  IS NOT NULL
      THEN ST_Distance(
             ST_MakePoint(v_lng, v_lat)::geography,
             ST_MakePoint(u.lng::float8, u.lat::float8)::geography
           ) / 1609.344
      ELSE NULL
    END                            AS distance_miles
  FROM public.freelancer_profiles fp
  JOIN public.users u ON u.id = fp.user_id
  LEFT JOIN best_media bm ON bm.fp_id = fp.id
  WHERE fp.user_id != p_user_id
    AND fp.verification_status != 'rejected'
    AND (
      v_lat IS NULL OR v_lng IS NULL
      OR u.lat IS NULL OR u.lng IS NULL
      OR v_radius IS NULL
      OR ST_Distance(
           ST_MakePoint(v_lng, v_lat)::geography,
           ST_MakePoint(u.lng::float8, u.lat::float8)::geography
         ) / 1609.344 <= v_radius
    )
  ORDER BY
    CASE WHEN v_service_prefs IS NOT NULL
              AND fp.service_categories && v_service_prefs
         THEN 0 ELSE 1
    END,
    fp.updated_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_feed_items(UUID, INTEGER, INTEGER) TO authenticated;

-- ── realtime ─────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
