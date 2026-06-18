-- Lakeview initial schema

-- connector_credentials: stores auth tokens + full sync_data per connector per org
create table if not exists connector_credentials (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  connector_id  text not null,
  credentials   jsonb not null default '{}',
  status        text not null default 'connected',
  sync_data     jsonb,
  last_sync     timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(org_id, connector_id)
);

alter table connector_credentials enable row level security;

create policy "members read own org connector data"
  on connector_credentials for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "admins manage connector data"
  on connector_credentials for all
  using (org_id in (select org_id from org_members where user_id = auth.uid() and role = 'admin'));

-- updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger connector_credentials_updated_at
  before update on connector_credentials
  for each row execute procedure set_updated_at();
