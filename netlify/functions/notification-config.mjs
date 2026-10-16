import {notificationEnvironment} from '../../lib/server/notifications.js';

export default async function notificationConfig(request) {
 if (request.method !== 'GET') return new Response(null, {status: 405, headers: {Allow: 'GET'}});
 const environment = notificationEnvironment();
 return Response.json({enabled: environment.enabled, publicKey: environment.enabled ? environment.publicKey : ''}, {
  headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}
 });
}

export const config = {path: '/api/notification-config', method: 'GET'};
