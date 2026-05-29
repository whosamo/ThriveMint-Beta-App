create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  business_user_id uuid not null references users(id) on delete cascade,
  title text not null,
  summary text not null,
  service_category text not null,
  deliverables jsonb not null default '[]'::jsonb,
  timeline text,
  budget_range text,
  ideal_freelancer_profile text,
  created_at timestamptz not null default now()
);

alter table briefs enable row level security;

create policy "Users can manage their own briefs"
  on briefs for all
  using (auth.uid() = business_user_id)
  with check (auth.uid() = business_user_id);

create index briefs_business_user_id_idx on briefs(business_user_id);
