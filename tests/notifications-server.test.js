import {test} from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import {notificationEnvironment, validPushSubscription, notificationPayload, dispatchNotifications, makeNotificationRpc, makePushTransport} from '../lib/server/notifications.js';
import notificationConfig from '../netlify/functions/notification-config.mjs';
import {config as schedule} from '../netlify/functions/notification-dispatch.mjs';

const eventId = '10000000-0000-4000-8000-000000000001';
const accountId = '20000000-0000-4000-8000-000000000001';
const subscription = {endpoint: 'https://fcm.googleapis.com/fcm/send/device', expirationTime: null, keys: {p256dh: 'B'.repeat(87), auth: 'a'.repeat(22)}};

test('Push config is opt-in, server-only secrets never appear in the public response', async () => {
 const vapid = webpush.generateVAPIDKeys();
 const vars = {ATLAS_NOTIFICATIONS_ENABLED: 'true', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'SERVER_ONLY_SECRET', ATLAS_VAPID_PUBLIC_KEY: vapid.publicKey, ATLAS_VAPID_PRIVATE_KEY: vapid.privateKey, ATLAS_VAPID_SUBJECT: 'mailto:alerts@example.invalid'};
 const get = name => vars[name];
 assert.equal(notificationEnvironment(get).enabled, true);
 for (const missing of Object.keys(vars)) {
  const incomplete = {...vars}; delete incomplete[missing];
  assert.equal(notificationEnvironment(name => incomplete[name]).enabled, false, missing);
 }
 assert.equal(notificationEnvironment(name => name === 'ATLAS_VAPID_PRIVATE_KEY' ? webpush.generateVAPIDKeys().privateKey : vars[name]).enabled, false, 'public and private VAPID keys must match');
 const saved = globalThis.Netlify;
 try {
  globalThis.Netlify = {env: {get}};
  const response = await notificationConfig(new Request('https://atlas.invalid/api/notification-config'));
  const body = await response.text();
  assert.deepEqual(JSON.parse(body), {enabled: true, publicKey: vapid.publicKey});
  assert.ok(!body.includes(vars.SUPABASE_SERVICE_ROLE_KEY)); assert.ok(!body.includes(vapid.privateKey));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  vars.ATLAS_NOTIFICATIONS_ENABLED = 'false';
  assert.deepEqual(await (await notificationConfig(new Request('https://atlas.invalid/api/notification-config'))).json(), {enabled: false, publicKey: ''});
 } finally { globalThis.Netlify = saved; }
 assert.deepEqual(schedule, {schedule: '*/5 * * * *'});
});

test('Push rejects arbitrary or expired endpoints and emits only generic payloads', () => {
 for (const endpoint of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/a', 'https://region.web.push.apple.com/a']) assert.ok(validPushSubscription({...subscription, endpoint}), endpoint);
 for (const endpoint of ['http://fcm.googleapis.com/fcm/send/x', 'https://fcm.googleapis.com.evil.invalid/fcm/send/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com@localhost/fcm/send/x', 'https://fcm.googleapis.com:444/fcm/send/x', 'https://web.push.apple.com.evil.invalid/x', 'https://fcm.googleapis.com/wrong/x']) assert.equal(validPushSubscription({...subscription, endpoint}), false, endpoint);
 assert.equal(validPushSubscription({...subscription, expirationTime: Date.now() - 1}), false);
 assert.equal(validPushSubscription({...subscription, keys: {auth: 'a', p256dh: 'b'}}), false);
 for (const kind of ['workout_reminder', 'plan_update', 'coach_comment', 'coach_digest']) {
  const payload = notificationPayload({id: eventId, user_id: accountId, kind, name: 'PRIVATE ATHLETE', km: 5, notes: 'PRIVATE HEALTH DATA'});
  assert.equal(payload.user_id, accountId); assert.ok(payload.url.startsWith('/app?view=')); assert.equal(payload.title, 'Atlas Run');
  assert.ok(!JSON.stringify(payload).includes('PRIVATE')); assert.ok(!('km' in payload)); assert.ok(!('notes' in payload));
 }
 assert.equal(notificationPayload({id: eventId, user_id: accountId, kind: 'invented'}), null);
});

test('Push dispatcher reauthorizes each lease and records success, retry, unsubscribe and cancellation', async () => {
 const statuses = [201, 410, 429, 503, null, 'invalid'];
 const claims = statuses.map((_, index) => ({id: `claim-${index}`, lease_token: `lease-${index}`}));
 const completed = [], transmitted = []; let queueCursor = 0;
 const rpc = async (name, args) => {
  if (name === 'atlas_prepare_notifications') return 6;
  if (name === 'atlas_claim_notifications') { assert.equal(args.p_limit, 1); return claims.slice(queueCursor, ++queueCursor); }
  const index = claims.findIndex(item => item.id === args.p_id);
  assert.equal(args.p_lease_token, claims[index].lease_token);
  if (name === 'atlas_authorize_notification') return statuses[index] === null ? null : {id: eventId, user_id: accountId, kind: 'plan_update', subscription: statuses[index] === 'invalid' ? {...subscription, endpoint: 'https://localhost/private'} : {...subscription, endpoint: subscription.endpoint + index}};
  if (name === 'atlas_finish_notification') { completed.push(args); return null; }
  throw new Error('Unexpected RPC');
 };
 const send = async (device, payload) => {
  const index = Number(device.endpoint.at(-1)); transmitted.push(index);
  assert.equal(payload.id, eventId); assert.equal(payload.user_id, accountId);
  if (statuses[index] !== 201) throw {statusCode: statuses[index]};
  return {statusCode: 201};
 };
 const summary = await dispatchNotifications({rpc, send});
 assert.deepEqual(transmitted.sort(), [0, 1, 2, 3]);
 assert.deepEqual(completed.sort((a, b) => a.p_id.localeCompare(b.p_id)).map(item => item.p_status), [201, 410, 429, 503, 0, 410]);
 assert.deepEqual(summary, {claimed: 6, sent: 1, cancelled: 3, retried: 2});
});

test('Real VAPID transport produces encrypted push data; RPC blocks redirects and uses server authorization', async () => {
 const vapid = webpush.generateVAPIDKeys();
 // A throwaway ECDH public key simulates a browser subscription without any network call.
 const {createECDH} = await import('node:crypto'); const client = createECDH('prime256v1'); client.generateKeys();
 const device = {...subscription, keys: {p256dh: client.getPublicKey().toString('base64url'), auth: Buffer.alloc(16, 7).toString('base64url')}};
 const environment = {supabaseUrl: 'https://project.supabase.co', serviceKey: 'server-key', publicKey: vapid.publicKey, privateKey: vapid.privateKey, subject: 'mailto:alerts@example.invalid'};
 const payload = notificationPayload({id: eventId, user_id: accountId, kind: 'workout_reminder'});
 const generated = webpush.generateRequestDetails(device, JSON.stringify(payload), {vapidDetails: {subject: environment.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey}, TTL: 300});
 assert.equal(generated.headers['Content-Encoding'], 'aes128gcm'); assert.ok(generated.headers.Authorization.startsWith('vapid '));
 assert.ok(!generated.body.toString().includes('Seu treino')); assert.equal(typeof makePushTransport(environment), 'function');
 const rpc = makeNotificationRpc(environment, async (url, options) => {
  assert.equal(url.href, 'https://project.supabase.co/rest/v1/rpc/atlas_prepare_notifications');
  assert.equal(options.headers.Authorization, 'Bearer server-key'); assert.equal(options.redirect, 'error');
  assert.ok(options.signal); return Response.json(3);
 });
 assert.equal(await rpc('atlas_prepare_notifications'), 3);
});

test('Push dispatch stops starting work with enough time to acknowledge the last send', async () => {
 let elapsed = 0, sends = 0, acknowledgements = 0, claims = 0;
 const latency = async () => {const start = elapsed; await Promise.resolve(); elapsed = Math.max(elapsed, start + 4000);};
 const rpc = async (name, args) => {
  await latency();
  if (name === 'atlas_prepare_notifications') return 0;
  if (name === 'atlas_claim_notifications') { assert.equal(args.p_limit, 1); return [{id: `claim-${++claims}`, lease_token: 'token'}]; }
  if (name === 'atlas_authorize_notification') return {id: eventId, user_id: accountId, kind: 'workout_reminder', subscription};
  if (name === 'atlas_finish_notification') { acknowledgements++; assert.equal(args.p_status, 201); return null; }
 };
 await dispatchNotifications({rpc, send: async () => { await latency(); sends++; return {statusCode: 201}; }, now: () => elapsed});
 assert.equal(sends, 3); assert.equal(acknowledgements, 3); assert.equal(claims, 3, 'waiting items are never leased and keep their attempt budget');
 assert.ok(elapsed <= 27000, 'the final send still has room for its acknowledgement inside 30 seconds');
});
