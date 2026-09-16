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
      if(state?.value === 'error') return Response.json({error:{message:'Isolated Stripe outage'}},{status:503});
      return Response.json({ id:'acct_e2e', configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:state?.value || 'active'}}}}} });
    }
    if (url.includes('/checkout/sessions/cs_expired')) return Response.json({id:'cs_expired',status:'expired'});
    const sessionMatch = new URL(url).pathname.match(/^\/v1\/checkout\/sessions\/(cs_booking_[a-z0-9-]+)$/);
    if(sessionMatch) {
      const booking=await db.prepare('SELECT * FROM customer_bookings WHERE stripe_checkout_session_id=?').bind(sessionMatch[1]).first<{id:string;offering_unit_amount:number}>();
      if(!booking) return Response.json({error:'Unknown fixture checkout'},{status:404});
      const captured=await db.prepare("SELECT id FROM e2e_provider_events WHERE kind='capture' AND payload=?").bind(`pi_${booking.id}`).first();
      return Response.json({id:sessionMatch[1],status:'complete',payment_status:captured?'paid':'unpaid',client_reference_id:booking.id,
        payment_intent:{id:`pi_${booking.id}`,status:captured?'succeeded':'requires_capture',capture_method:'manual',amount_capturable:booking.offering_unit_amount}});
    }
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
  const setting = async (id: string) => (await db.prepare('SELECT value FROM e2e_state WHERE id=?').bind(id).first<{value:string}>())?.value;
  if(url === 'https://oauth2.googleapis.com/token') {
    const mode = await setting('token');
    if(mode === 'revoked') return Response.json({error:'invalid_grant'}, {status:400});
    if(mode === 'outage') return Response.json({error:'unavailable'}, {status:503});
    return Response.json({access_token:'e2e_access',refresh_token:mode === 'no-refresh' ? undefined : 'e2e_refresh',expires_in:3600,
      scope: mode === 'partial' ? 'https://www.googleapis.com/auth/calendar.freebusy' : 'https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events.owned'});
  }
  if(url === 'https://oauth2.googleapis.com/revoke') {
    await db.prepare("INSERT OR REPLACE INTO e2e_provider_events VALUES ('revoke','revoke','redacted')").run();
    return new Response(null,{status:200});
  }
  if(url.includes('googleapis.com/calendar/v3/freeBusy')) {
    const mode = await setting('google');
    if(mode && ['401','403','429','503'].includes(mode)) return Response.json({error:'provider_failure'}, {status:Number(mode)});
    if(mode === 'mutate-schedule') {
      await db.prepare('UPDATE creator_availability_rules SET enabled=0').run();
      await db.prepare("UPDATE e2e_state SET value='active' WHERE id='google'").run();
    }
    if(mode === 'malformed') return Response.json({calendars:{primary:{errors:[{reason:'notFound'}]}}});
    return Response.json({calendars:{primary:{busy:JSON.parse(await setting('busy') || '[]')}}});
  }
  if(url.includes('googleapis.com/calendar/v3/calendars/') && url.includes('/events')) {
    const path = new URL(url).pathname;
    const body = JSON.parse(String(init?.body || '{}'));
    const id = init?.method === 'POST' ? body.id : path.split('/').at(-1);
    const existing = await db.prepare("SELECT payload FROM e2e_provider_events WHERE id=? AND kind='calendar'").bind(id).first<{payload:string}>();
    if(init?.method === 'POST') {
      if(existing) return Response.json({}, {status:409});
      const event = {...body, id, etag:'"1"', organizer:{email:'creator@example.com'},htmlLink:'https://calendar.google.com/e2e',conferenceData:{entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/e2e-fixture'}]}};
      await db.prepare('INSERT INTO e2e_provider_events (id,kind,payload) VALUES (?,?,?)').bind(id,'calendar',JSON.stringify(event)).run();
      if(await setting('calendar-insert') === 'lost-response') {
        await db.prepare("UPDATE e2e_state SET value='active' WHERE id='calendar-insert'").run();
        throw new Error('Isolated lost Calendar response after insert');
      }
      return Response.json(event);
    }
    if(await setting('calendar-account') === 'different') return Response.json({}, {status:404});
    if(!existing) return Response.json({}, {status:404});
    const event = JSON.parse(existing.payload);
    if(init?.method === 'PATCH' || init?.method === 'DELETE') {
      if(new Headers(init.headers).get('if-match') !== event.etag) return Response.json({}, {status:412});
      Object.assign(event, body, {etag:`"${Number(event.etag.replaceAll('"',''))+1}"`},init.method === 'DELETE' ? {status:'cancelled'} : {});
      await db.prepare('UPDATE e2e_provider_events SET payload=? WHERE id=?').bind(JSON.stringify(event),id).run();
      await db.prepare('INSERT INTO e2e_provider_events VALUES (?,?,?)').bind(crypto.randomUUID(),init.method,JSON.stringify({id,sendUpdates:new URL(url).searchParams.get('sendUpdates')})).run();
    }
    return Response.json(event);
  }
  throw new Error(`Unexpected provider request in isolated E2E: ${url.split('?')[0]}`);
}
