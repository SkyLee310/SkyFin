-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  monthly_budget numeric(10,2) not null default 0 check (monthly_budget >= 0),
  preferred_language text not null default 'en' check (preferred_language in ('en','zh','ms')),
  created_at timestamptz not null default now()
);

-- ============ CATEGORIES ============
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 40),
  kind text not null check (kind in ('expense','income')),
  default_essential boolean not null default true,
  is_preset boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, kind, name),
  unique (user_id, id)                      -- target for the composite FK below
);

-- ============ TRANSACTIONS ============
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  category_id uuid not null,
  type text not null check (type in ('expense','income')),
  payment_method text not null check (payment_method in ('Cash','eWallet','Card')),
  merchant text,
  item_label text,                          -- normalised by AI: 'boba', 'mamak', 'grab ride'
  receipt_url text,                         -- Storage object path, nulled after 1 month
  receipt_group_id uuid,
  note text,
  date date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  is_essential boolean not null default true,
  exclude_from_pace boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- category must belong to the same user (FKs bypass RLS)
  foreign key (user_id, category_id) references public.categories (user_id, id),
  check (date <= (now() at time zone 'Asia/Kuala_Lumpur')::date + 1)  -- +1 tolerates clock skew
);
create index transactions_user_date on public.transactions (user_id, date desc);
create index transactions_group on public.transactions (receipt_group_id) where receipt_group_id is not null;
create index transactions_receipt on public.transactions (receipt_url) where receipt_url is not null;

-- ============ AUDIT REPORTS ============
create table public.audit_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  type text not null check (type in ('weekly_audit','monthly_audit','budget_warning')),
  level text check (level in ('info','warning','critical','spike')),
  period_start date,
  period_end date,
  dedup_key text not null,                  -- e.g. 'weekly:2026-09-14', 'pace:warning:2026-09-21', 'threshold:80:2026-09'
  content jsonb not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedup_key)               -- makes every job idempotent
);
create index audit_reports_user_created on public.audit_reports (user_id, created_at desc);

-- ============ PUSH SUBSCRIPTIONS ============
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ============ AI USAGE (daily cap) ============
create table public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  calls int not null default 0,
  primary key (user_id, day)
);

-- ============ RLS ============
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['categories','transactions','audit_reports','push_subscriptions','ai_usage'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all
      using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ============ FUNCTIONS ============
-- Atomic AI-call counter; returns false once the daily cap is reached.
create function public.consume_ai_call(p_limit int default 100) returns boolean
language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  insert into ai_usage (user_id, day, calls)
  values (auth.uid(), (now() at time zone 'Asia/Kuala_Lumpur')::date, 1)
  on conflict (user_id, day) do update set calls = ai_usage.calls + 1
  returning calls into n;
  return n <= p_limit;
end $$;

-- Storage objects to delete: older than 1 month, or unreferenced and older than 24 h.
create function public.receipts_to_purge() returns table (name text)
language sql security definer set search_path = public, storage as $$
  select o.name from storage.objects o
  where o.bucket_id = 'receipts'
    and (
      o.created_at < now() - interval '1 month'
      or (o.created_at < now() - interval '24 hours'
          and not exists (select 1 from public.transactions t where t.receipt_url = o.name))
    );
$$;
revoke all on function public.receipts_to_purge() from public, anon, authenticated;

-- New user: profile + preset categories
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id);
  insert into categories (user_id, name, kind, default_essential, is_preset) values
    (new.id,'Food & Drinks','expense',true,true),
    (new.id,'Groceries','expense',true,true),
    (new.id,'Transport','expense',true,true),
    (new.id,'Education','expense',true,true),
    (new.id,'Rent & Utilities','expense',true,true),
    (new.id,'Phone & Internet','expense',true,true),
    (new.id,'Health','expense',true,true),
    (new.id,'Shopping','expense',false,true),
    (new.id,'Entertainment','expense',false,true),
    (new.id,'Subscriptions','expense',false,true),
    (new.id,'Others','expense',true,true),
    (new.id,'Allowance / PTPTN','income',true,true),
    (new.id,'Scholarship','income',true,true),
    (new.id,'Part-time','income',true,true),
    (new.id,'Family','income',true,true),
    (new.id,'Others','income',true,true);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ GRANTS ============
-- New Supabase projects (auto_expose_new_tables = false) give the Data API roles no DML on new
-- tables, but they keep truncate, references and trigger, and Postgres grants execute on new
-- functions to public. Revoke all, then grant, so the result is the same on old and new
-- defaults; RLS still decides which rows each user sees.
revoke all on table public.profiles, public.categories, public.transactions,
  public.audit_reports, public.push_subscriptions, public.ai_usage
  from anon, authenticated, service_role;
grant select, insert, update, delete on table public.profiles, public.categories,
  public.transactions, public.audit_reports, public.push_subscriptions, public.ai_usage
  to authenticated, service_role;
revoke all on function public.consume_ai_call(int), public.receipts_to_purge(),
  public.handle_new_user() from public, anon, authenticated, service_role;
grant execute on function public.consume_ai_call(int) to authenticated;
grant execute on function public.receipts_to_purge() to service_role;
