-- =============================================================================
-- ThriveMint — Initial Database Schema
-- Two-sided local marketplace: businesses <-> freelancers/agencies
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Shared helper: auto-stamp updated_at on every mutation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- TABLE DEFINITIONS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. users
--    One row per auth.users entry. Mirrors the Supabase auth table so the
--    app can JOIN freely without going through auth schema.
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id                      UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                   TEXT          NOT NULL UNIQUE,
  full_name               TEXT          NOT NULL DEFAULT '',
  avatar_url              TEXT,
  role                    TEXT          NOT NULL DEFAULT 'business'
                                        CHECK (role IN ('business', 'freelancer', 'both')),
  city                    TEXT,
  state                   TEXT,
  lat                     NUMERIC(9,6),
  lng                     NUMERIC(9,6),
  -- Populated automatically by trg_sync_user_location whenever lat/lng change
  location                GEOGRAPHY(POINT, 4326),
  radius_preference_miles INTEGER       NOT NULL DEFAULT 25
                                        CHECK (radius_preference_miles > 0),
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Keep the PostGIS POINT in sync with lat/lng columns
CREATE OR REPLACE FUNCTION sync_user_location()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::GEOGRAPHY;
  ELSE
    NEW.location = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_user_location
  BEFORE INSERT OR UPDATE OF lat, lng ON public.users
  FOR EACH ROW EXECUTE FUNCTION sync_user_location();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-provision a public.users row when Supabase Auth creates an account
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();


-- ---------------------------------------------------------------------------
-- 2. freelancer_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.freelancer_profiles (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID          NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  bio                 TEXT,
  hourly_rate         NUMERIC(10,2) CHECK (hourly_rate >= 0),
  availability        TEXT          CHECK (availability IN ('full_time', 'part_time', 'contract', 'unavailable')),
  years_experience    INTEGER       CHECK (years_experience >= 0),
  service_categories  TEXT[]        NOT NULL DEFAULT '{}',
  portfolio_urls      TEXT[]        NOT NULL DEFAULT '{}',
  verification_status TEXT          NOT NULL DEFAULT 'pending'
                                    CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  badges              TEXT[]        NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_freelancer_profiles_updated_at
  BEFORE UPDATE ON public.freelancer_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 3. business_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.business_profiles (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  business_name       TEXT        NOT NULL,
  industry            TEXT,
  bio                 TEXT,
  website             TEXT,
  verification_status TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_business_profiles_updated_at
  BEFORE UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 4. portfolio_items
-- ---------------------------------------------------------------------------
CREATE TABLE public.portfolio_items (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  freelancer_id UUID        NOT NULL REFERENCES public.freelancer_profiles(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL CHECK (type IN ('video', 'image', 'before_after', 'testimonial')),
  media_url     TEXT,
  title         TEXT,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 5. shortlists
--    A business saves a freelancer for later — one row per pair.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shortlists (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_user_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  freelancer_user_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_user_id, freelancer_user_id),
  CHECK  (business_user_id <> freelancer_user_id)
);


-- ---------------------------------------------------------------------------
-- 6. conversations
--    One thread per business–freelancer pair.
-- ---------------------------------------------------------------------------
CREATE TABLE public.conversations (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_user_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  freelancer_user_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_user_id, freelancer_user_id),
  CHECK  (business_user_id <> freelancer_user_id)
);


-- ---------------------------------------------------------------------------
-- 7. messages
-- ---------------------------------------------------------------------------
CREATE TABLE public.messages (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES public.users(id)         ON DELETE CASCADE,
  content         TEXT,
  file_url        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Every message must carry at least text or a file
  CHECK (content IS NOT NULL OR file_url IS NOT NULL)
);


-- ---------------------------------------------------------------------------
-- 8. projects
-- ---------------------------------------------------------------------------
CREATE TABLE public.projects (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_user_id   UUID          NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  freelancer_user_id UUID          NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  title              TEXT          NOT NULL,
  description        TEXT,
  status             TEXT          NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'active', 'completed', 'disputed')),
  total_amount       NUMERIC(12,2) CHECK (total_amount >= 0),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CHECK (business_user_id <> freelancer_user_id)
);

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 9. milestones
-- ---------------------------------------------------------------------------
CREATE TABLE public.milestones (
  id                       UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id               UUID          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title                    TEXT          NOT NULL,
  amount                   NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  due_date                 DATE,
  status                   TEXT          NOT NULL DEFAULT 'pending'
                                         CHECK (status IN ('pending', 'released')),
  stripe_payment_intent_id TEXT,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 10. reviews
--     One review per reviewer per project; reviewer ≠ reviewee.
-- ---------------------------------------------------------------------------
CREATE TABLE public.reviews (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reviewer_id    UUID        NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  reviewee_id    UUID        NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  rating         SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  written_review TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, reviewer_id),
  CHECK  (reviewer_id <> reviewee_id)
);


-- =============================================================================
-- INDEXES
-- =============================================================================

-- users
CREATE INDEX idx_users_role          ON public.users(role);
CREATE INDEX idx_users_location      ON public.users USING GIST(location);   -- radius queries
CREATE INDEX idx_users_city_state    ON public.users(city, state);

-- freelancer_profiles
CREATE INDEX idx_fp_user_id              ON public.freelancer_profiles(user_id);
CREATE INDEX idx_fp_service_categories  ON public.freelancer_profiles USING GIN(service_categories);
CREATE INDEX idx_fp_verification_status ON public.freelancer_profiles(verification_status);
CREATE INDEX idx_fp_hourly_rate         ON public.freelancer_profiles(hourly_rate);

-- business_profiles
CREATE INDEX idx_bp_user_id  ON public.business_profiles(user_id);

-- portfolio_items
CREATE INDEX idx_pi_freelancer_id ON public.portfolio_items(freelancer_id);
CREATE INDEX idx_pi_type          ON public.portfolio_items(type);

-- shortlists
CREATE INDEX idx_sl_business   ON public.shortlists(business_user_id);
CREATE INDEX idx_sl_freelancer ON public.shortlists(freelancer_user_id);

-- conversations
CREATE INDEX idx_conv_business   ON public.conversations(business_user_id);
CREATE INDEX idx_conv_freelancer ON public.conversations(freelancer_user_id);

-- messages
CREATE INDEX idx_msg_conversation ON public.messages(conversation_id);
CREATE INDEX idx_msg_sender       ON public.messages(sender_id);
CREATE INDEX idx_msg_created_at   ON public.messages(created_at DESC);  -- inbox pagination

-- projects
CREATE INDEX idx_proj_business   ON public.projects(business_user_id);
CREATE INDEX idx_proj_freelancer ON public.projects(freelancer_user_id);
CREATE INDEX idx_proj_status     ON public.projects(status);

-- milestones
CREATE INDEX idx_mile_project ON public.milestones(project_id);
CREATE INDEX idx_mile_status  ON public.milestones(status);

-- reviews
CREATE INDEX idx_rev_project  ON public.reviews(project_id);
CREATE INDEX idx_rev_reviewer ON public.reviews(reviewer_id);
CREATE INDEX idx_rev_reviewee ON public.reviews(reviewee_id);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews             ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- users
--   • Any signed-in user can browse the directory.
--   • Only the account owner can mutate their own row.
--   • INSERT is handled exclusively by the auth trigger (SECURITY DEFINER).
-- ---------------------------------------------------------------------------
CREATE POLICY "users: authenticated can view all"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users: owner can update own row"
  ON public.users FOR UPDATE
  TO authenticated
  USING     (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- freelancer_profiles
-- ---------------------------------------------------------------------------
CREATE POLICY "fp: authenticated can view all"
  ON public.freelancer_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "fp: owner can insert own profile"
  ON public.freelancer_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fp: owner can update own profile"
  ON public.freelancer_profiles FOR UPDATE
  TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fp: owner can delete own profile"
  ON public.freelancer_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- business_profiles
-- ---------------------------------------------------------------------------
CREATE POLICY "bp: authenticated can view all"
  ON public.business_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "bp: owner can insert own profile"
  ON public.business_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bp: owner can update own profile"
  ON public.business_profiles FOR UPDATE
  TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bp: owner can delete own profile"
  ON public.business_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- portfolio_items
--   • Public SELECT (discovery).
--   • Mutations restricted to the freelancer who owns the parent profile.
-- ---------------------------------------------------------------------------
CREATE POLICY "pi: authenticated can view all"
  ON public.portfolio_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "pi: freelancer can manage own items"
  ON public.portfolio_items FOR ALL
  TO authenticated
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

-- ---------------------------------------------------------------------------
-- shortlists
--   Only the business that created a shortlist entry can see or modify it.
-- ---------------------------------------------------------------------------
CREATE POLICY "sl: business owns its shortlist"
  ON public.shortlists FOR ALL
  TO authenticated
  USING     (auth.uid() = business_user_id)
  WITH CHECK (auth.uid() = business_user_id);

-- ---------------------------------------------------------------------------
-- conversations
--   Both participants can read; either side can open a new thread.
-- ---------------------------------------------------------------------------
CREATE POLICY "conv: participants can view"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = business_user_id OR auth.uid() = freelancer_user_id);

CREATE POLICY "conv: either participant can create"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = business_user_id OR auth.uid() = freelancer_user_id);

-- ---------------------------------------------------------------------------
-- messages
--   Read and write gated on conversation membership.
--   Sender must identify themselves honestly (sender_id = auth.uid()).
-- ---------------------------------------------------------------------------
CREATE POLICY "msg: participants can read"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE  c.id = conversation_id
        AND (c.business_user_id = auth.uid() OR c.freelancer_user_id = auth.uid())
    )
  );

CREATE POLICY "msg: participants can send"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE  c.id = conversation_id
        AND (c.business_user_id = auth.uid() OR c.freelancer_user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- projects
--   Business creates; both parties read and update (e.g. status transitions).
-- ---------------------------------------------------------------------------
CREATE POLICY "proj: participants can view"
  ON public.projects FOR SELECT
  TO authenticated
  USING (auth.uid() = business_user_id OR auth.uid() = freelancer_user_id);

CREATE POLICY "proj: business can create"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = business_user_id);

CREATE POLICY "proj: participants can update"
  ON public.projects FOR UPDATE
  TO authenticated
  USING     (auth.uid() = business_user_id OR auth.uid() = freelancer_user_id)
  WITH CHECK (auth.uid() = business_user_id OR auth.uid() = freelancer_user_id);

-- ---------------------------------------------------------------------------
-- milestones
--   Visible to both project participants.
--   Only the business can add milestones; both can update (e.g. release funds).
-- ---------------------------------------------------------------------------
CREATE POLICY "mile: participants can view"
  ON public.milestones FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE business_user_id = auth.uid() OR freelancer_user_id = auth.uid()
    )
  );

CREATE POLICY "mile: business can create milestones"
  ON public.milestones FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE business_user_id = auth.uid()
    )
  );

CREATE POLICY "mile: participants can update milestones"
  ON public.milestones FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE business_user_id = auth.uid() OR freelancer_user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE business_user_id = auth.uid() OR freelancer_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- reviews
--   Publicly visible. Only project participants can leave a review; only the
--   reviewer can edit their own review.
-- ---------------------------------------------------------------------------
CREATE POLICY "rev: authenticated can view all"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rev: project participant can review"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND project_id IN (
      SELECT id FROM public.projects
      WHERE business_user_id = auth.uid() OR freelancer_user_id = auth.uid()
    )
  );

CREATE POLICY "rev: reviewer can edit own review"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING     (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());


-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- Returns approved freelancers within `radius_miles` of a lat/lng center,
-- ordered by ascending distance. Used by the Explore screen.
CREATE OR REPLACE FUNCTION search_freelancers_within_radius(
  center_lat   NUMERIC,
  center_lng   NUMERIC,
  radius_miles NUMERIC DEFAULT 25
)
RETURNS TABLE (
  freelancer_id  UUID,
  user_id        UUID,
  full_name      TEXT,
  avatar_url     TEXT,
  city           TEXT,
  state          TEXT,
  hourly_rate    NUMERIC,
  service_categories TEXT[],
  distance_miles NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    fp.id                  AS freelancer_id,
    u.id                   AS user_id,
    u.full_name,
    u.avatar_url,
    u.city,
    u.state,
    fp.hourly_rate,
    fp.service_categories,
    ROUND(
      (ST_Distance(
        u.location,
        ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::GEOGRAPHY
      ) / 1609.344)::NUMERIC,
      1
    ) AS distance_miles
  FROM public.freelancer_profiles fp
  JOIN public.users u ON u.id = fp.user_id
  WHERE u.location IS NOT NULL
    AND fp.verification_status = 'approved'
    AND ST_DWithin(
      u.location,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::GEOGRAPHY,
      radius_miles * 1609.344   -- metres
    )
  ORDER BY distance_miles ASC;
$$;
