import { env } from 'cloudflare:workers';
export async function fixtureFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  const db = env.DB as D1Database;
  if (url.startsWith('https://api.resend.com/')) {
    const body = String(init?.body || '{}');
    const key = new Headers(init?.headers).get('idempotency-key') || crypto.randomUUID();
    await db.prepare('INSERT OR IGNORE INTO e2e_provider_events (id, kind, payload) VALUES (?, ?, ?)').bind(key,'email',body).run();
    return Response.json({id:key});
  }
  if (url.startsWith('https://api.stripe.com/')) {
    if (url.includes('/v2/core/accounts/')) {
      const state = await db.prepare("SELECT value FROM e2e_state WHERE id='stripe'").first<{value:string}>();
      return Response.json({ id:'acct_e2e', configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:state?.value || 'active'}}}}} });
    }
    if (url.includes('/checkout/sessions/cs_expired')) return Response.json({id:'cs_expired',status:'expired'});
    if (url.endsWith('/balance')) return Response.json({available:[{amount:12345,currency:'usd'}],pending:[{amount:5000,currency:'usd'}]});
    if (url.endsWith('/login_links')) return Response.json({url:'http://127.0.0.1:4173/e2e-control?stripe-dashboard=1'});
    if (url.endsWith('/checkout/sessions')) {
      const body = new URLSearchParams(String(init?.body)); const booking = body.get('client_reference_id');
      await db.prepare('INSERT OR IGNORE INTO e2e_provider_events (id,kind,payload) VALUES (?,?,?)').bind(`checkout_${booking}`,'checkout',body.toString()).run();
      return Response.json({id:`cs_${booking}`,url:`http://127.0.0.1:4173/e2e-control?checkout=${booking}`});
    }
    const match = url.match(/payment_intents\/([^/]+)\/(capture|cancel)$/);
    if(match) {
      const key = new Headers(init?.headers).get('idempotency-key')!;
      await db.prepare('INSERT OR IGNORE INTO e2e_provider_events (id,kind,payload) VALUES (?,?,?)').bind(key,match[2],match[1]).run();
      return Response.json({id:match[1],status:match[2] === 'capture' ? 'succeeded' : 'canceled'});
    }
  }
  if(url.includes('googleapis.com/calendar/v3/freeBusy')) return Response.json({calendars:{primary:{busy:[]}}});
  if(url.includes('googleapis.com/calendar/v3/calendars/primary/events')) {
    const body = JSON.parse(String(init?.body || '{}'));
    return Response.json({id:body.id || 'event_e2e',htmlLink:'https://calendar.google.com/e2e',conferenceData:{entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/e2e-fixture'}]}});
  }
  throw new Error(`Unexpected provider request in isolated E2E: ${url}`);
}
