-- Receipts bucket and its per-user folder policies (0002_storage.sql, F1 criterion 2).
-- Run with `npx supabase test db` against the local stack. Everything rolls back at the end.
-- User A is aaaaaaaa-…, user B is bbbbbbbb-…; B plays the attacker.
begin;
select plan(14);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user-a@skyfin.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'user-b@skyfin.test');

-- ============ POLICIES ============
-- Storage refuses SQL deletes on storage.objects, so the delete policy is pinned here and
-- exercised through the Storage API in tests/e2e/m4-receipts.spec.ts.
select policies_are('storage', 'objects',
  array['own receipts read', 'own receipts insert', 'own receipts delete'],
  'storage.objects has exactly the three receipts policies');
select policy_cmd_is('storage', 'objects', 'own receipts delete', 'delete', 'the delete policy covers deletes');
select policy_roles_are('storage', 'objects', 'own receipts delete', array['authenticated'],
  'only signed-in users can delete, and the USING clause limits them to their own folder');

-- ============ BUCKET ============
select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'receipts' $$,
  $$ values (false, 2097152::bigint, array['image/jpeg']::text[]) $$,
  'receipts is private, 2 MB, JPEG only'
);

-- ============ USER A uploads ============
select set_config('request.jwt.claims',
  '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('receipts', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a.jpg', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  'A can upload into their own folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('receipts', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/planted.jpg', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  '42501', null,
  'A cannot upload into B''s folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('receipts', 'a-at-the-root.jpg', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  '42501', null,
  'A cannot upload outside a user folder'
);
select results_eq(
  $$ select name from storage.objects where bucket_id = 'receipts' $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a.jpg'::text) $$,
  'A sees their own receipt'
);

-- ============ USER B ============
select set_config('request.jwt.claims',
  '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('receipts', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/b.jpg', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') $$,
  'B can upload into their own folder'
);
select results_eq(
  $$ select name from storage.objects where bucket_id = 'receipts' $$,
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/b.jpg'::text) $$,
  'B reads only their own receipt'
);
select is_empty(
  $$ update storage.objects set name = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/stolen.jpg'
     where name = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a.jpg' returning name $$,
  'B cannot move A''s receipt into their folder'
);
select is_empty(
  $$ update storage.objects set metadata = '{}'
     where name = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/b.jpg' returning name $$,
  'no one can overwrite a receipt, not even their own'
);

-- ============ ANON ============
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select is_empty($$ select name from storage.objects where bucket_id = 'receipts' $$, 'anon sees no receipts');

-- ============ A IS UNTOUCHED ============
reset role;
select results_eq(
  $$ select name from storage.objects where bucket_id = 'receipts' order by name $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/a.jpg'::text), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/b.jpg') $$,
  'A''s receipt is still there'
);

select * from finish();
rollback;
