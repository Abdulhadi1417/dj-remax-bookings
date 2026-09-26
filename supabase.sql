-- شغّل هذا الملف مرة وحدة في Supabase: SQL Editor → New query → الصق → Run
create table if not exists bookings (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists expenses (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists settings (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table bookings enable row level security;
alter table expenses enable row level security;
alter table settings enable row level security;

-- الوصول للمستخدمين المسجلين فقط. اقفل التسجيل الجديد من:
-- Authentication → Sign In / Providers → Allow new users to sign up (أطفِه)
create policy "signed-in access" on bookings for all to authenticated using (true) with check (true);
create policy "signed-in access" on expenses for all to authenticated using (true) with check (true);
create policy "signed-in access" on settings for all to authenticated using (true) with check (true);
