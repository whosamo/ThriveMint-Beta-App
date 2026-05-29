-- ── Add 'contract' to message_type constraint ────────────────────────────────
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_type_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_type_check
  CHECK (message_type IN ('text', 'image', 'meeting', 'project', 'system', 'contract'));

-- ── contracts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contracts (
  id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id              UUID          NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  business_user_id        UUID          NOT NULL REFERENCES public.users(id),
  freelancer_user_id      UUID          NOT NULL REFERENCES public.users(id),
  scope_text              TEXT          NOT NULL DEFAULT '',
  deliverables            JSONB         NOT NULL DEFAULT '[]',
  revision_policy         TEXT          NOT NULL DEFAULT '1_revision'
                          CHECK (revision_policy IN ('1_revision', '2_revisions', 'unlimited', 'custom')),
  revision_custom_text    TEXT,
  ip_clause_enabled       BOOLEAN       NOT NULL DEFAULT true,
  confidentiality_enabled BOOLEAN       NOT NULL DEFAULT true,
  business_signed_at      TIMESTAMPTZ,
  freelancer_signed_at    TIMESTAMPTZ,
  status                  TEXT          NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'pending_signature', 'active')),
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts: participants can view"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (auth.uid() = business_user_id OR auth.uid() = freelancer_user_id);

CREATE POLICY "contracts: business can create"
  ON public.contracts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = business_user_id);

CREATE POLICY "contracts: participants can update"
  ON public.contracts FOR UPDATE
  TO authenticated
  USING  (auth.uid() = business_user_id OR auth.uid() = freelancer_user_id)
  WITH CHECK (auth.uid() = business_user_id OR auth.uid() = freelancer_user_id);

CREATE INDEX IF NOT EXISTS idx_contracts_project    ON public.contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_business   ON public.contracts(business_user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_freelancer ON public.contracts(freelancer_user_id);
