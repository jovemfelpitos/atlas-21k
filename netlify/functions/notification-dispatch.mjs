import {notificationEnvironment, makeNotificationRpc, makePushTransport, dispatchNotifications} from '../../lib/server/notifications.js';

export default async function notificationDispatch() {
 const environment = notificationEnvironment();
 if (!environment.enabled) return;
 // Scheduled functions cannot be invoked by a public URL on Netlify.
 const summary = await dispatchNotifications({rpc: makeNotificationRpc(environment), send: makePushTransport(environment)});
 console.info('Atlas notification batch', summary);
}

// UTC cadence; the database converts each opted-in user's IANA time zone and chosen hour.
export const config = {schedule: '*/5 * * * *'};
