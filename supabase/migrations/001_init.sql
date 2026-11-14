-- Pacha bot: agricultores, terrenos, historial y conversación
create table if not exists public.farmers (
  telegram_id bigint primary key,
  nombre text,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parcels (
  id bigint generated always as identity primary key,
  telegram_id bigint not null references public.farmers(telegram_id) on delete cascade,
  provincia text,
  lat double precision not null,
  lon double precision not null,
  elevacion double precision,
  suelo jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.history (
  id bigint generated always as identity primary key,
  telegram_id bigint not null references public.farmers(telegram_id) on delete cascade,
  kind text not null,
  summary text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  telegram_id bigint not null references public.farmers(telegram_id) on delete cascade,
  role text not null check (role in ('user', 'model')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists history_farmer_idx on public.history (telegram_id, created_at desc);
create index if not exists messages_farmer_idx on public.messages (telegram_id, created_at desc);
create index if not exists parcels_farmer_idx on public.parcels (telegram_id, created_at desc);

-- Solo el bot (service_role) accede. RLS activo y sin políticas bloquea a anon y authenticated.
alter table public.farmers enable row level security;
alter table public.parcels enable row level security;
alter table public.history enable row level security;
alter table public.messages enable row level security;
