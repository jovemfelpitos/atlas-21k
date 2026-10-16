import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {parsePlan} from '../importer.js';

const migration = 'supabase/migrations/20261016192208_atlas_run_notification_delivery.sql';
const ids = Array.from({length: 5}, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
const [A, B, OWNER, COACH, STRANGER] = ids;
const subscription = suffix => ({endpoint: `https://fcm.googleapis.com/fcm/send/device-${suffix}`, keys: {p256dh: 'B'.repeat(87), auth: 'a'.repeat(22)}, expirationTime: null});

async function fixture() {
 const db = new PGlite();
 const sql = async (query, args = []) => (await db.query(query, args)).rows;
 const schema = async file => db.exec(readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
 const actor = async (id, role = 'authenticated') => {
  await db.exec('reset role');
  await sql("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
  await db.exec('set role ' + role);
 };
 await db.exec(`create role anon;create role authenticated;create role service_role;
  create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,
   raw_user_meta_data jsonb default '{}',is_anonymous boolean default false,deleted_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 for (const file of ['schema-v2.sql', 'schema-v3.sql', 'schema-v4.sql', 'supabase/migrations/20261013205525_atlas_run_ux01_accounts_and_areas.sql', migration]) await schema(file);
 for (const id of ids) await sql('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [id, `${id}@example.invalid`]);
 await sql('insert into public.atlas_admins values($1)', [OWNER]);
 await actor(OWNER);
 await sql('insert into public.atlas_coaches(user_id) values($1)', [COACH]);
 await sql('insert into public.atlas_coach_athletes(coach_id,athlete_id) values($1,$2)', [COACH, A]);
 const prefs = async (user, categories = {}) => {
  await actor(user);
  await sql(`insert into public.atlas_notification_preferences(user_id,enabled,workout_reminders,plan_updates,coach_comments,coach_digest,time_zone)
   values($1,true,$2,$3,$4,$5,'UTC') on conflict(user_id) do update set enabled=excluded.enabled,
   workout_reminders=excluded.workout_reminders,plan_updates=excluded.plan_updates,coach_comments=excluded.coach_comments,coach_digest=excluded.coach_digest`,
   [user, !!categories.workout_reminders, !!categories.plan_updates, !!categories.coach_comments, !!categories.coach_digest]);
  await sql('select public.atlas_save_push_subscription($1::jsonb)', [JSON.stringify(subscription(user.slice(-1)))]);
 };
 let publication = 0;
 const publish = async (athlete = A) => {
  const doc = parsePlan(readFileSync(new URL('../modelo-plano.csv', import.meta.url), 'utf8'));
  doc.name = `Plano de teste ${++publication}`;
  const today = (await sql("select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD') as day"))[0].day;
  doc.sessions = doc.sessions.slice(0, 2).map(s => ({...s, date: today}));
  await actor(OWNER);
  const draft = (await sql('select public.atlas_save_draft(null,$1,$2::jsonb,null,null) draft', [athlete, JSON.stringify(doc)]))[0].draft;
  return (await sql('select public.atlas_publish_draft($1,$2) plan', [draft.id, draft.revision]))[0].plan;
 };
 const service = async () => actor(null, 'service_role');
 const prepare = async () => { await service(); return sql('select public.atlas_prepare_notifications()'); };
 const claim = async () => { await service(); return (await sql('select public.atlas_claim_notifications() items'))[0].items; };
 const authorize = async claim => (await sql('select public.atlas_authorize_notification($1,$2) item', [claim.id, claim.lease_token]))[0].item;
 const finish = async (claim, status) => sql('select public.atlas_finish_notification($1,$2,$3)', [claim.id, claim.lease_token, status]);
 const privileged = async () => { await db.exec('reset role'); };
 return {db, sql, actor, prefs, publish, service, prepare, claim, authorize, finish, privileged};
}

test('Push privacy: own preferences only, immutable metadata, device validation and service-only queue', async () => {
 const f = await fixture(); const {db, sql, actor, prefs} = f;
 try {
  await prefs(A, {plan_updates: true});
  const row = (await sql('select * from public.atlas_notification_preferences'))[0];
  assert.equal(row.user_id, A); assert.equal(row.reminder_time, '07:00:00'); assert.ok(row.activated_at);
  await assert.rejects(sql("update public.atlas_notification_preferences set activated_at='2000-01-01'"), /permission denied/);
  await assert.rejects(sql('update public.atlas_notification_preferences set user_id=$1', [B]), /Conta imutável|row-level security/);
  await assert.rejects(sql("update public.atlas_notification_preferences set time_zone='invented/zone'"), /Fuso horário inválido/);
  await actor(B); assert.equal((await sql('select * from public.atlas_notification_preferences')).length, 0);
  assert.equal((await sql('update public.atlas_notification_preferences set enabled=false where user_id=$1 returning *', [A])).length, 0);
  await assert.rejects(sql('insert into public.atlas_notification_preferences(user_id) values($1)', [A]), /row-level security/);
  await actor(OWNER); assert.equal((await sql('select * from public.atlas_notification_preferences')).length, 0);
  for (const user of [A, B, COACH, OWNER]) {
   await actor(user);
   await assert.rejects(sql('select * from atlas_private.push_subscriptions'), /permission denied/);
   await assert.rejects(sql('select public.atlas_claim_notifications()'), /permission denied/);
  }
  await actor(A);
  for (const name of ['atlas_prepare_notifications()', 'atlas_authorize_notification(null,null)', 'atlas_finish_notification(null,null,201)']) {
   await assert.rejects(sql('select public.' + name), /permission denied/);
  }
  for (const endpoint of ['https://localhost/push', 'http://fcm.googleapis.com/fcm/send/x', 'https://fcm.googleapis.com.evil.invalid/fcm/send/x', 'https://fcm.googleapis.com@127.0.0.1/x', 'https://web.push.apple.com.evil.invalid/x']) {
   await assert.rejects(sql('select public.atlas_save_push_subscription($1::jsonb)', [JSON.stringify({...subscription('bad'), endpoint})]), /Assinatura push inválida/);
  }
  await actor(B); await sql('select public.atlas_remove_push_subscription($1)', [subscription(A.slice(-1)).endpoint]);
  await f.privileged(); assert.equal((await sql('select count(*)::int n from atlas_private.push_subscriptions'))[0].n, 1);
  await actor(A); await sql('select public.atlas_remove_push_subscription($1)', [subscription(A.slice(-1)).endpoint]);
  await f.privileged(); assert.equal((await sql('select count(*)::int n from atlas_private.push_subscriptions'))[0].n, 0);
  await actor(null, 'anon'); await assert.rejects(sql('select * from public.atlas_notification_preferences'), /permission denied/);
  await assert.rejects(sql('select public.atlas_save_push_subscription($1::jsonb)', [JSON.stringify(subscription('anon'))]), /permission denied/);
 } finally { await db.close(); }
});

test('Push queue: no activation backfill, one delivery per device/event, retries and expired devices', async () => {
 const f = await fixture(); const {db, sql, actor, prefs, publish, prepare, claim, authorize, finish} = f;
 try {
  await publish(); await prefs(A, {plan_updates: true}); await prepare(); assert.deepEqual(await claim(), []);
  const plan = await publish(); await prepare();
  const items = await claim(); assert.equal(items.length, 1);
  const event = await authorize(items[0]); assert.equal(event.kind, 'plan_update'); assert.equal(event.user_id, A);
  assert.ok(!JSON.stringify(event).includes('goal_km')); assert.deepEqual(await claim(), []);
  await finish(items[0], 503); assert.deepEqual(await claim(), []);
  await f.privileged(); await sql("update atlas_private.notification_deliveries set next_attempt_at=clock_timestamp()-interval '1 minute'");
  const retry = (await claim())[0]; assert.equal(retry.id, items[0].id); assert.notEqual(retry.lease_token, items[0].lease_token);
  await finish(items[0], 201); assert.ok(await authorize(retry), 'stale lease cannot acknowledge a newer attempt');
  await finish(retry, 201); await prepare(); assert.deepEqual(await claim(), []);
  await publish(); await prepare(); const expired = (await claim())[0]; await finish(expired, 410);
  await f.privileged(); assert.equal((await sql('select count(*)::int n from atlas_private.push_subscriptions'))[0].n, 0);
  await actor(A); await sql('select public.atlas_save_push_subscription($1::jsonb)', [JSON.stringify(subscription('replacement'))]);
  await prepare(); assert.deepEqual(await claim(), [], 'new device must not receive existing events');
  await publish(); await prepare(); const pending = (await claim())[0];
  await actor(A); await sql('update public.atlas_notification_preferences set enabled=false');
  await f.service(); assert.equal(await authorize(pending), null, 'opt-out applies after claim');
  await f.privileged(); assert.equal((await sql('select state from public.atlas_plans where id=$1', [plan]))[0].state, 'published');
 } finally { await db.close(); }
});

test('Push device account changes invalidate old leases; quota and retry limits are durable', async () => {
 const f = await fixture(); const {db, sql, actor, prefs, publish, prepare, claim, authorize, finish} = f;
 try {
  await prefs(A, {plan_updates: true}); await publish(); await prepare(); const old = (await claim())[0];
  await actor(B); await sql('select public.atlas_save_push_subscription($1::jsonb)', [JSON.stringify(subscription(A.slice(-1)))]);
  await f.service(); assert.equal(await authorize(old), null, 'a device rebound to a different account cannot get its previous account event');
  await actor(A);
  for (let i = 0; i < 10; i++) await sql('select public.atlas_save_push_subscription($1::jsonb)', [JSON.stringify(subscription('quota-' + i))]);
  await assert.rejects(sql('select public.atlas_save_push_subscription($1::jsonb)', [JSON.stringify(subscription('quota-extra'))]), /Limite de 10/);
  await sql('select public.atlas_save_push_subscription($1::jsonb)', [JSON.stringify(subscription('quota-0'))]);
  await publish(); await prepare();
  // Retain only one test device to inspect exactly the same delivery over five failed attempts.
  await actor(A);
  for (let i = 1; i < 10; i++) await sql('select public.atlas_remove_push_subscription($1)', [subscription('quota-' + i).endpoint]);
  let deliveryId;
  for (let attempt = 1; attempt <= 5; attempt++) {
   await f.privileged(); await sql("update atlas_private.notification_deliveries set next_attempt_at=clock_timestamp()-interval '1 minute'");
   const item = (await claim())[0]; assert.ok(item); deliveryId ||= item.id; assert.equal(item.id, deliveryId);
   await finish(item, 429);
  }
  await f.privileged(); await sql("update atlas_private.notification_deliveries set next_attempt_at=clock_timestamp()-interval '1 minute'");
  await f.service(); assert.deepEqual(await claim(), []);
  await f.privileged(); const row = (await sql('select attempts,status from atlas_private.notification_deliveries where id=$1', [deliveryId]))[0];
  assert.deepEqual(row, {attempts: 5, status: 'failed'});
 } finally { await db.close(); }
});

test('Push reminders and coach events recheck records, plan state, current links and opted-in windows', async () => {
 const f = await fixture(); const {db, sql, actor, prefs, publish, prepare, claim, authorize} = f;
 try {
  await prefs(A, {workout_reminders: true, coach_comments: true});
  await prefs(COACH, {coach_digest: true});
  const plan = await publish();
  await f.privileged();
  // Test-only historical activation simulates a prior opt-in; clients cannot write these fields.
  await db.exec('alter table public.atlas_notification_preferences disable trigger check_notification_preferences');
  await sql("update public.atlas_notification_preferences set activated_at=clock_timestamp()-interval '2 days', reminder_time=date_trunc('minute',(clock_timestamp() at time zone 'UTC')-interval '1 minute')::time");
  await db.exec('alter table public.atlas_notification_preferences enable trigger check_notification_preferences');
  await prepare();
  const reminder = (await claim())[0]; assert.ok(reminder);
  assert.equal((await authorize(reminder)).kind, 'workout_reminder');
  await actor(A);
  for (const [session, status] of [['sessao-001', 'não feito'], ['sessao-002', 'adaptado']]) {
   await sql('insert into public.atlas_activity_records(user_id,plan_id,session_id,status) values($1,$2,$3,$4)', [A, plan, session, status]);
  }
  await f.service(); assert.equal(await authorize(reminder), null, 'every explicit status suppresses the reminder');
  await actor(COACH);
  await sql("select public.atlas_add_session_comment('10000000-0000-4000-8000-000000000001',$1,$2,'sessao-001','Texto privado')", [A, plan]);
  await prepare(); const comments = await claim(); assert.equal(comments.length, 1); assert.equal((await authorize(comments[0])).kind, 'coach_comment');
  await actor(OWNER); await sql('update public.atlas_coach_athletes set active=false where coach_id=$1', [COACH]);
  await f.service(); assert.equal(await authorize(comments[0]), null, 'revoked coach comment must not be delivered');
  await actor(OWNER); await sql('update public.atlas_coach_athletes set active=true where coach_id=$1', [COACH]);
  await f.privileged();
  await sql("update atlas_private.notification_activity_signals set touched_at=clock_timestamp()-interval '2 hours'");
  await prepare(); let digest;
  for (const item of await claim()) if ((await authorize(item))?.kind === 'coach_digest') digest = item;
  assert.ok(digest); assert.equal((await authorize(digest)).kind, 'coach_digest');
  await actor(OWNER); await sql('update public.atlas_coaches set active=false where user_id=$1', [COACH]);
  await f.service(); assert.equal(await authorize(digest), null);
 } finally { await db.close(); }
});
