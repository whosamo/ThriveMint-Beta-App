ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS badges TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS years_experience INTEGER;

ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'portfolio';

ALTER TABLE public.portfolio_items
  DROP CONSTRAINT IF EXISTS portfolio_items_category_check;

ALTER TABLE public.portfolio_items
  ADD CONSTRAINT portfolio_items_category_check
  CHECK (category IN ('portfolio', 'before_after', 'testimonial'));

CREATE INDEX IF NOT EXISTS idx_portfolio_items_category
  ON public.portfolio_items (category);
