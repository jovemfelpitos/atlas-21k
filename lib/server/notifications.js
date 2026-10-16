import webpush from 'web-push';
import {createECDH} from 'node:crypto';
import {Agent} from 'node:https';

const pushHosts = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com']);
const messages = Object.freeze({
 workout_reminder: {body: 'Seu treino de hoje está disponível. Abra o Atlas Run para conferir.', url: '/app?view=today'},
 plan_update: {body: 'Há um novo plano disponível. Abra o Atlas Run para conferir.', url: '/app?view=calendar'},
 coach_comment: {body: 'Você recebeu uma atualização da sua equipe. Abra o Atlas Run para conferir.', url: '/app?view=today'},
 coach_digest: {body: 'Há novos registros para acompanhar. Abra o Atlas Run para conferir.', url: '/app?view=progress'}
});

/** Read server-only runtime configuration. Never load this module into the static build. */
export function notificationEnvironment(get = name => globalThis.Netlify?.env?.get(name)) {
 const result = {
  supabaseUrl: get('SUPABASE_URL') || '',
  serviceKey: get('SUPABASE_SERVICE_ROLE_KEY') || '',
  publicKey: get('ATLAS_VAPID_PUBLIC_KEY') || '',
  privateKey: get('ATLAS_VAPID_PRIVATE_KEY') || '',
  subject: get('ATLAS_VAPID_SUBJECT') || ''
 };
 let valid = false;
 try {
  const api = new URL(result.supabaseUrl);
  const subject = new URL(result.subject);
  const vapid = createECDH('prime256v1');
  vapid.setPrivateKey(Buffer.from(result.privateKey, 'base64url'));
  valid = api.protocol === 'https:' && !api.username && !api.password && !api.search && !api.hash
   && Boolean(result.serviceKey) && /^([A-Za-z0-9_-]{87}=?)$/.test(result.publicKey)
   && /^([A-Za-z0-9_-]{43}=?)$/.test(result.privateKey)
   && vapid.getPublicKey().equals(Buffer.from(result.publicKey, 'base64url'))
   && (subject.protocol === 'mailto:' && /^[^?\s]+@[^?\s]+$/.test(subject.pathname)
    || subject.protocol === 'https:' && Boolean(subject.hostname) && !subject.username && !subject.password);
 } catch {}
 return {...result, enabled: get('ATLAS_NOTIFICATIONS_ENABLED') === 'true' && valid};
}

export function validPushSubscription(subscription) {
 if (!subscription || typeof subscription !== 'object') return false;
 try {
  const endpoint = new URL(subscription.endpoint);
  const host = endpoint.hostname;
  const provider = pushHosts.has(host) || /^(?:[a-z0-9-]+\.)*web\.push\.apple\.com$/.test(host);
  const path = host === 'fcm.googleapis.com' ? /^\/(?:fcm\/send|wp)\/[^/]+/.test(endpoint.pathname)
   : host === 'updates.push.services.mozilla.com' ? /^\/wpush\/v[12]\/[^/]+/.test(endpoint.pathname)
   : endpoint.pathname.length > 1;
  return provider && path && endpoint.protocol === 'https:' && !endpoint.username && !endpoint.password
   && !endpoint.port && !endpoint.hash && subscription.endpoint.length <= 4096
   && /^[A-Za-z0-9_-]{87}=?$/.test(subscription.keys?.p256dh || '')
   && /^[A-Za-z0-9_-]{22}(==)?$/.test(subscription.keys?.auth || '')
   && (subscription.expirationTime == null || Number.isFinite(subscription.expirationTime) && subscription.expirationTime > Date.now());
 } catch { return false; }
}

export function notificationPayload(event) {
 const content = messages[event?.kind];
 if (!content || !/^[a-f0-9-]{36}$/i.test(event.id) || !/^[a-f0-9-]{36}$/i.test(event.user_id)) return null;
 return {id: event.id, kind: event.kind, user_id: event.user_id, title: 'Atlas Run', ...content, tag: `atlas-${event.id}`};
}

export function makeNotificationRpc(environment, fetcher = fetch) {
 return async (name, body = {}) => {
  const response = await fetcher(new URL(`/rest/v1/rpc/${name}`, environment.supabaseUrl), {
   method: 'POST', headers: {apikey: environment.serviceKey, Authorization: `Bearer ${environment.serviceKey}`, 'Content-Type': 'application/json'},
   body: JSON.stringify(body), signal: AbortSignal.timeout(4000), redirect: 'error'
  });
  // Do not put response bodies, endpoint URLs, tokens, or athlete data into logs.
  if (!response.ok) throw new Error(`Notification database request failed (${response.status})`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
 };
}

/** Real encrypted VAPID transport; endpoint validation also occurs before every send. */
export function makePushTransport(environment) {
 return async (subscription, payload) => {
  const agent = new Agent({keepAlive: false});
  let timer;
  try {
   const sending = webpush.sendNotification(subscription, JSON.stringify(payload), {
    vapidDetails: {subject: environment.subject, publicKey: environment.publicKey, privateKey: environment.privateKey},
    TTL: 300, urgency: 'normal', timeout: 4000, agent,
    // Repeated attempts replace the same notification on supporting push services.
    topic: payload.id.replaceAll('-', '').slice(0, 32)
   });
   // The library's timeout is an idle socket timeout. Also bound the full operation,
   // destroy its dedicated connection and reserve time to acknowledge the attempt.
   const deadline = new Promise((_, reject) => {timer = setTimeout(() => {
    agent.destroy(); reject(new Error('Push delivery deadline exceeded'));
   }, 4000);});
   return await Promise.race([sending, deadline]);
  } finally {clearTimeout(timer); agent.destroy();}
 };
}

export async function dispatchNotifications({rpc, send, now = Date.now, maxDurationMs = 11000}) {
 const started = now();
 const summary = {claimed: 0, sent: 0, cancelled: 0, retried: 0};
 await rpc('atlas_prepare_notifications');
 let cursor = 0;
 async function worker() {
  while (cursor < 20 && now() - started < maxDurationMs) {
   cursor++;
   // Claim only the item this worker will process now. A time-budget exit must not
   // consume attempts for devices waiting behind the current batch.
   const claimed = await rpc('atlas_claim_notifications', {p_limit: 1});
   if (!Array.isArray(claimed) || claimed.length > 1) throw new Error('Invalid notification queue response');
   const claim = claimed[0];
   if (!claim) return;
   summary.claimed++;
   const args = {p_id: claim.id, p_lease_token: claim.lease_token};
   // Current preferences, device ownership and team authorization are checked again here.
   const event = await rpc('atlas_authorize_notification', args);
   const payload = notificationPayload(event);
   let status = 0;
   if (payload && validPushSubscription(event.subscription)) {
    try { const response = await send(event.subscription, payload); status = response?.statusCode || 201; }
    catch (error) { status = Number.isInteger(error?.statusCode) ? error.statusCode : 503; }
   } else if (event?.subscription) {
    // An expired or malformed subscription is retired without contacting any endpoint.
    status = 410;
   }
   await rpc('atlas_finish_notification', {...args, p_status: status});
   if (status >= 200 && status < 300) summary.sent++;
   else if (status === 0 || status === 404 || status === 410 || status >= 400 && status < 500 && ![408, 429].includes(status)) summary.cancelled++;
   else summary.retried++;
  }
 }
 // Each new cycle reserves 4s each for claim, authorization, transport and acknowledgement.
 // At most 3 workers and 20 actual claims; waiting devices keep all their retry attempts.
 await Promise.all(Array.from({length: 3}, worker));
 return summary;
}
