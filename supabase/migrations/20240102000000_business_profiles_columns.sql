-- Add service preference and budget columns that the onboarding flow collects
-- but were absent from the initial schema.

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS service_preferences TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS budget_range         TEXT;

CREATE INDEX IF NOT EXISTS idx_bp_service_preferences
  ON public.business_profiles USING GIN(service_preferences);
