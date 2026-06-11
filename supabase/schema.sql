-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) >= 2),
  phone text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists signups_email_unique on public.signups (lower(email));

alter table public.signups enable row level security;

-- 클라이언트 직접 접근 차단 (서버의 Service Role Key만 insert 가능)
revoke all on public.signups from anon, authenticated;
