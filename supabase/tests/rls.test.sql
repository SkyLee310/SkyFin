-- RLS isolation and Data API privileges for the tables and functions in 0001_init.sql.
-- Run with `npx supabase test db` against the local stack. Everything rolls back at the end.
-- User A is aaaaaaaa-…, user B is bbbbbbbb-…; B plays the attacker.
begin;
select plan(49);

-- ============ FIXTURES (as postgres, which owns the tables and so bypasses RLS) ============
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user-a@skyfin.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'user-b@skyfin.test');

-- on_auth_user_created seeds each new user.
select results_eq(
  $$ select id from public.profiles
     where id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
     order by id $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') $$,
  'a new user gets a profile'
);
select results_eq(
  $$ select user_id, kind, count(*) from public.categories
     where user_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
     group by user_id, kind order by user_id, kind $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'expense'::text, 11::bigint),
            ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'income', 5),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'expense', 11),
            ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'income', 5) $$,
  'a new user gets 11 expense and 5 income preset categories'
);

-- One row per user in every other table, so "B reads only its own rows" fails both when a
-- policy leaks A's rows and when it hides B's.
insert into public.transactions (user_id, amount, category_id, type, payment_method)
  select user_id, 12.50, id, 'expense', 'Cash' from public.categories
  where name = 'Food & Drinks'
    and user_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.audit_reports (user_id, type, dedup_key, content) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'weekly_audit', 'weekly:2026-09-14', '{}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'weekly_audit', 'weekly:2026-09-14', '{}');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'https://push.skyfin.test/a', 'p256dh-a', 'auth-a'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'https://push.skyfin.test/b', 'p256dh-b', 'auth-b');
-- A past day, so consume_ai_call below starts a fresh row for today.
insert into public.ai_usage (user_id, day, calls) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2000-01-01', 7),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2000-01-01', 7);

-- ============ PRIVILEGES ============
-- New Supabase projects give the Data API roles no DML on new tables but leave truncate,
-- references, trigger and function execute, so 0001 revokes all and grants explicitly.
-- These pin the exact sets: a missing grant breaks the app, an extra one widens it.
select table_privs_are('public', t, 'anon', '{}'::name[], format('anon has no privileges on %s', t))
from unnest(array['profiles', 'categories', 'transactions', 'audit_reports',
                  'push_subscriptions', 'ai_usage']::name[]) as t;

select table_privs_are('public', t, r, '{SELECT,INSERT,UPDATE,DELETE}'::name[],
                       format('%s has exactly select, insert, update, delete on %s', r, t))
from unnest(array['authenticated', 'service_role']::name[]) as r,
     unnest(array['profiles', 'categories', 'transactions', 'audit_reports',
                  'push_subscriptions', 'ai_usage']::name[]) as t;

select function_privs_are('public', fn, args, r, privs, format('%s privileges on %s()', r, fn))
from (values
  ('consume_ai_call'::name, '{integer}'::name[], 'anon'::name, '{}'::name[]),
  ('consume_ai_call',       '{integer}',         'authenticated', '{EXECUTE}'),
  ('consume_ai_call',       '{integer}',         'service_role',  '{}'),
  ('receipts_to_purge',     '{}',                'anon',          '{}'),
  ('receipts_to_purge',     '{}',                'authenticated', '{}'),
  ('receipts_to_purge',     '{}',                'service_role',  '{EXECUTE}'),
  ('handle_new_user',       '{}',                'anon',          '{}'),
  ('handle_new_user',       '{}',                'authenticated', '{}'),
  ('handle_new_user',       '{}',                'service_role',  '{}')
) as f(fn, args, r, privs);

-- ============ USER B (authenticated) ============
select set_config('request.jwt.claims',
  '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}', true);
set local role authenticated;

select results_eq('select id from public.profiles',
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid) $$, 'B reads only its own profile');
select results_eq('select user_id, count(*) from public.categories group by user_id',
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 16::bigint) $$,
  'B reads only its own 16 categories');
select results_eq('select user_id from public.transactions',
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid) $$, 'B reads only its own transactions');
select results_eq('select user_id from public.audit_reports',
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid) $$, 'B reads only its own audit reports');
select results_eq('select user_id from public.push_subscriptions',
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid) $$,
  'B reads only its own push subscriptions');
select results_eq('select user_id from public.ai_usage',
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid) $$, 'B reads only its own AI usage');

-- Updates and deletes are filtered to B's rows, so aiming at A's rows touches nothing.
select is_empty(
  $$ update public.profiles set monthly_budget = 999
     where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning id $$,
  'B cannot update A''s profile');
select is_empty(
  $$ delete from public.transactions
     where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning id $$,
  'B cannot delete A''s transactions');

-- Inserts are checked against WITH CHECK, so writing a row as A fails outright.
select throws_ok(
  $$ insert into public.profiles (id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  '42501', 'new row violates row-level security policy for table "profiles"',
  'B cannot create a profile for A');
select throws_ok(
  $$ insert into public.categories (user_id, name, kind)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Planted', 'expense') $$,
  '42501', 'new row violates row-level security policy for table "categories"',
  'B cannot add a category for A');
select throws_ok(
  $$ insert into public.transactions (user_id, amount, category_id, type, payment_method)
     select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, id, 'expense', 'Cash'
     from public.categories limit 1 $$,
  '42501', 'new row violates row-level security policy for table "transactions"',
  'B cannot add a transaction for A');
select throws_ok(
  $$ insert into public.audit_reports (user_id, type, dedup_key, content)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'budget_warning', 'planted', '{}') $$,
  '42501', 'new row violates row-level security policy for table "audit_reports"',
  'B cannot add an audit report for A');
select throws_ok(
  $$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'https://push.skyfin.test/planted', 'p', 'a') $$,
  '42501', 'new row violates row-level security policy for table "push_subscriptions"',
  'B cannot add a push subscription for A');
select throws_ok(
  $$ insert into public.ai_usage (user_id, day, calls)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2000-01-02', 0) $$,
  '42501', 'new row violates row-level security policy for table "ai_usage"',
  'B cannot add AI usage for A');

-- M2.1: Composite FK prevents B from referencing A's category, even when user_id = B passes RLS
select throws_ok(
  $$ insert into public.transactions (user_id, amount, category_id, type, payment_method)
     values (
       'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
       10.00,
       (select id from public.categories where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' limit 1),
       'expense',
       'Cash'
     ) $$,
  '23503',
  null,
  'Composite FK prevents B from referencing A''s category');

-- consume_ai_call is security invoker, so this needs the grants and B's own RLS to line up.
select is(public.consume_ai_call(), true, 'B can call consume_ai_call');

-- ============ ANON ============
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

select throws_ok('select 1 from public.profiles',
  '42501', 'permission denied for table profiles', 'anon cannot read profiles');
select throws_ok('select public.consume_ai_call()',
  '42501', 'permission denied for function consume_ai_call', 'anon cannot call consume_ai_call');

-- ============ A IS UNTOUCHED ============
reset role;

select is((select monthly_budget from public.profiles
           where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0.00,
  'A''s budget is unchanged');
select is((select count(*) from public.transactions
           where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1::bigint,
  'A''s transaction is still there');

select * from finish();
rollback;
