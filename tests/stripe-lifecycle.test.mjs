import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

// Execute the real domain and route code against SQLite, using D1's statement API.
const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
  sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
}
function prepare(sql) {
  let args = [];
  const statement = {
    bind(...values) { args = values; return statement; },
    async raw() { const query = sqlite.prepare(sql); query.setReturnArrays(true); return query.all(...args); },
    async all() { return { results: sqlite.prepare(sql).all(...args), success: true }; },
    async run() { return { meta: sqlite.prepare(sql).run(...args), success: true }; },
  };
  return statement;
}
globalThis.__stripeLifecycleEnv = { DB: {
  prepare,
  async batch(statements) {
    sqlite.exec("BEGIN");
    try { const results = []; for (const statement of statements) results.push(await statement.all()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
} };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = globalThis.__stripeLifecycleEnv", shortCircuit: true };
    if (specifier === "next/headers") return { url: "data:text/javascript,export const headers = () => new Headers()", shortCircuit: true };
    if (specifier.startsWith(".")) {
      const base = fileURLToPath(new URL(specifier, context.parentURL));
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(base + suffix)) return { url: pathToFileURL(base + suffix).href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (/\.tsx?$/.test(url) && !url.includes("node_modules")) {
      return { format: "module", source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText, shortCircuit: true };
    }
    return next(url, context);
  },
});

const { POST: webhook } = await import("../app/api/stripe/webhook/route.ts");
const { GET: complete } = await import("../app/api/stripe/checkout/complete/route.ts");
const { POST: approve } = await import("../app/api/bookings/approve/route.ts");
const { getCustomerBooking } = await import("../app/_lib/bookings.ts");
Object.assign(process.env, {ZOOM_ACCOUNT_ID:'test',ZOOM_CLIENT_ID:'test',ZOOM_CLIENT_SECRET:'test',ZOOM_HOST_USER_IDS:'["host_test"]'});
process.env.STRIPE_SECRET_KEY = "sk_test_lifecycle";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_lifecycle";
process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED = "true";
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "test-calendar-secret";
const { encryptToken } = await import("../app/_lib/token-encryption.ts");
sqlite.prepare("INSERT INTO creator_calendar_connections(creator_id,scopes,access_token_encrypted,expires_at) VALUES('test-creator','calendar',?,?)").run(await encryptToken("test-token",process.env.GOOGLE_TOKEN_ENCRYPTION_KEY),Date.now()+3600000);


function seed(id) {
  const creatorId = `test-creator-${id}`;
  sqlite.prepare("INSERT INTO creator_onboarding_profiles(id,name,email,instagram_platform,bio,application_status,published_at,profile_saved_at,public_slug) VALUES (?,'Test','test@example.com','style','','accepted','2026-09-01','2026-09-01',?)").run(creatorId,creatorId);
  sqlite.prepare("UPDATE creator_onboarding_profiles SET seat_15_enabled=1,seat_15_price_amount=50 WHERE id=?").run(creatorId);
  sqlite.prepare("INSERT INTO creator_calendar_connections(creator_id,scopes,access_token_encrypted,expires_at) SELECT ?,scopes,access_token_encrypted,expires_at FROM creator_calendar_connections WHERE creator_id='test-creator'").run(creatorId);
  sqlite.prepare("INSERT INTO creator_availability_rules(creator_id,timezone,day_of_week,start_time,end_time,min_notice_minutes,buffer_minutes) VALUES (?,'America/New_York',4,'09:00','17:00',0,0)").run(creatorId);
  const bookingId = `booking_${id}`;
  sqlite.prepare("INSERT INTO customer_bookings (id, creator_id, creator_name, seat_id, seat_name, customer_email, appointment_start_at, appointment_end_at, timezone, status, stripe_checkout_session_id) VALUES (?, ?, 'Test Creator', 'test-seat', '15 minutes', 'test@example.com', '2026-10-01T09:00:00', '2026-10-01T09:15:00', 'America/New_York', 'requested', ?)").run(bookingId, creatorId, `cs_${id}`);
  return bookingId;
}
function session(id, status = "complete", intentStatus = "requires_capture") {
  return { id: `cs_${id}`, status, payment_status: intentStatus === "succeeded" ? "paid" : "unpaid",
    metadata: { booking_id: `booking_${id}` },
    payment_intent: { id: `pi_${id}`, status: intentStatus, amount_received:intentStatus === "succeeded" ? 5000 : 0, capture_method: "manual", amount:5000,currency:"usd",latest_charge:{payment_method_details:{type:"card",card:{capture_before:Math.floor(Date.now()/1000)+5*86400}}}, amount_capturable: intentStatus === "requires_capture" ? 5000 : 0, metadata: { booking_id: `booking_${id}` } } };
}
async function event(type, object, timestamp = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify({ id: "evt_lifecycle", type, data: { object } });
  const signature = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest("hex");
  return webhook(new Request("http://localhost/api/stripe/webhook", { method: "POST", body, headers: { "stripe-signature": `t=${timestamp},v1=${signature}` } }));
}
async function withStripe(value, run) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.ok(String(url).startsWith("https://api.stripe.com/"));
    return Response.json(String(url).includes("/payment_intents/") ? value.payment_intent : value);
  };
  try { await run(); } finally { globalThis.fetch = original; }
}

test("unfinished, processing, and zero-capturable checkouts cannot authorize a booking", async () => {
  const id = "incomplete"; seed(id);
  for (const value of [session(id, "open", "requires_payment_method"), session(id, "complete", "processing"), { ...session(id), payment_intent: { ...session(id).payment_intent, amount_capturable: 0 } }]) {
    await withStripe(value, async () => {
      const response = await complete(new Request(`http://localhost/api/stripe/checkout/complete?booking_id=booking_${id}&session_id=cs_${id}`));
      assert.match(response.headers.get("location"), /booking=error/);
      assert.equal((await getCustomerBooking(`booking_${id}`)).status, "requested");
      assert.equal((await event("checkout.session.completed", value)).status, 200);
      assert.equal((await getCustomerBooking(`booking_${id}`)).status, "requested");
    });
  }
});

test("authorization, capture recovery, duplicate events, and delayed cancellation retain the correct state", async () => {
  const id = "lifecycle"; seed(id);
  await withStripe(session(id), async () => {
    assert.equal((await event("checkout.session.completed", session(id))).status, 200);
    assert.equal((await getCustomerBooking(`booking_${id}`)).status, "payment_authorized");
    assert.equal((await event("checkout.session.completed", session(id))).status, 200);
    const response = await complete(new Request(`http://localhost/api/stripe/checkout/complete?booking_id=booking_${id}&session_id=cs_${id}`));
    assert.match(response.headers.get("location"), /booking=authorized/);
  });
  const paid = session(id, "complete", "succeeded");
  await withStripe(paid, async () => {
    assert.equal((await event("payment_intent.succeeded", paid.payment_intent)).status, 200);
    assert.equal((await getCustomerBooking(`booking_${id}`)).status, "paid");
    await event("payment_intent.succeeded", paid.payment_intent);
    await event("payment_intent.canceled", { ...paid.payment_intent, status: "canceled" });
    assert.equal((await getCustomerBooking(`booking_${id}`)).status, "paid");
    sqlite.prepare("UPDATE customer_bookings SET status = 'approved' WHERE id = ?").run(`booking_${id}`);
    await event("checkout.session.completed", paid);
    assert.equal((await getCustomerBooking(`booking_${id}`)).status, "approved");
  });
});

test("capture arriving before Checkout completion still recovers payment", async () => {
  const id = "outoforder"; seed(id);
  const paid = { ...session(id, "open", "succeeded"), payment_status: "unpaid" };
  await withStripe(paid, async () => {
    await event("payment_intent.succeeded", paid.payment_intent);
    assert.equal((await getCustomerBooking(`booking_${id}`)).status, "paid");
  });
});

test("canceled authorizations and expired checkouts close unpaid requests", async () => {
  const id = "canceled"; seed(id);
  await withStripe(session(id), async () => { await event("checkout.session.completed", session(id)); });
  const canceled = session(id, "complete", "canceled");
  await withStripe(canceled, async () => {
    await event("payment_intent.canceled", canceled.payment_intent);
    assert.equal((await getCustomerBooking(`booking_${id}`)).status, "payment_canceled");
  });
  const expiredId = "expired"; seed(expiredId);
  const expired = session(expiredId, "expired", "requires_payment_method");
  await withStripe(expired, async () => {
    await event("checkout.session.expired", expired);
    assert.equal((await getCustomerBooking(`booking_${expiredId}`)).status, "checkout_expired");
  });
});

test("unrelated intents and sessions cannot pay another booking", async () => {
  const id = "binding"; seed(id);
  const other = session("other", "complete", "succeeded");
  await withStripe(other, async () => {
    await event("checkout.session.completed", { ...other, metadata: { booking_id: `booking_${id}` } });
    await event("payment_intent.succeeded", { ...other.payment_intent, id: "pi_wrong", metadata: { booking_id: `booking_${id}` } });
    assert.equal((await getCustomerBooking(`booking_${id}`)).status, "requested");
  });
});

test("Stripe errors request redelivery and stale signatures cannot mutate bookings", async () => {
  const id = "retry"; seed(id);
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: "unavailable" }, { status: 503 });
  try {
    assert.equal((await event("checkout.session.completed", session(id))).status, 500);
    assert.equal((await event("checkout.session.completed", session(id), Math.floor(Date.now()/1000)-600)).status, 400);
    assert.equal((await getCustomerBooking(`booking_${id}`)).status, "requested");
  } finally { globalThis.fetch = original; }
});

test("only an authorized creator/admin can capture, and repeated approvals do not recapture", async () => {
  const id = "approve"; const bookingId = seed(id);
  await withStripe(session(id), async () => { await event("checkout.session.completed", session(id)); });
  const original = globalThis.fetch; const captures = [];
  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://zoom.us/oauth/token') return Response.json({access_token:'test'});
    if (String(url).includes('api.zoom.us')) { if(options?.method === 'POST') throw new Error('Zoom fixture outage'); return Response.json({meetings:[]}); }
    if (String(url).includes('/payment_intents/') && !String(url).endsWith('/capture')) return Response.json(captures.length ? {...session(id).payment_intent,status:'succeeded',amount_received:5000} : session(id).payment_intent);
    if (String(url).endsWith("/freeBusy")) return Response.json({calendars:{primary:{busy:[]}}});
    assert.match(String(url), /payment_intents\/pi_approve\/capture$/);
    captures.push(options.headers["idempotency-key"]);
    return Response.json({ id: "pi_approve", status: "succeeded" });
  };
  try {
    const request = (admin) => new Request("http://localhost/api/bookings/approve", { method: "POST", body: new URLSearchParams({ bookingId }), headers: admin ? { cookie: "tas_local_admin=1" } : {} });
    const forbidden = await approve(request(false));
    assert.match(forbidden.headers.get("location"), /creator-access/);
    assert.equal(captures.length, 0);
    await approve(request(true));
    assert.equal((await getCustomerBooking(bookingId)).status, "paid");
    await approve(request(true));
    assert.deepEqual(captures, ["take-a-seat-capture-pi_approve"]);
  } finally { globalThis.fetch = original; }
});


test("an incomplete Connect return does not mark the creator connected", async () => {
  const { GET: connectReturn } = await import("../app/api/stripe/connect/return/route.ts");
  sqlite.prepare("INSERT INTO creator_stripe_connections (creator_id, stripe_account_id, account_country) VALUES ('return-test','acct_return','US')").run();
  const original = globalThis.fetch;
  let status = "inactive";
  globalThis.fetch = async () => Response.json({ id: "acct_return", configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status } } } } } });
  try {
    const request = () => new Request("http://localhost/api/stripe/connect/return?creatorId=return-test", { headers: { cookie: "tas_local_admin=1" } });
    assert.match((await connectReturn(request())).headers.get("location"), /stripe-transfers/);
    assert.equal(sqlite.prepare("SELECT connected_at FROM creator_stripe_connections WHERE creator_id = 'return-test'").get().connected_at, null);
    status = "active";
    assert.match((await connectReturn(request())).headers.get("location"), /stripe=connected/);
    assert.ok(sqlite.prepare("SELECT connected_at FROM creator_stripe_connections WHERE creator_id = 'return-test'").get().connected_at);
  } finally { globalThis.fetch = original; }
});

test("a successful HTTP response without a successful capture cannot mark a booking paid", async () => {
  process.env.ZOOM_HOST_USER_IDS = '["host_processing"]';
  const id = "processingcapture"; const bookingId = seed(id);
  await withStripe(session(id), async () => { await event("checkout.session.completed", session(id)); });
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === 'https://zoom.us/oauth/token') return Response.json({access_token:'test'});
    if (String(url).includes('api.zoom.us')) return Response.json({meetings:[]});
    if (String(url).endsWith('/freeBusy')) return Response.json({calendars:{primary:{busy:[]}}});
    return Response.json(String(url).endsWith('/capture') ? {id:`pi_${id}`,status:'processing'} : session(id).payment_intent);
  };
  try {
    const response = await approve(new Request("http://localhost/api/bookings/approve", { method: "POST", body: new URLSearchParams({ bookingId }), headers: { cookie: "tas_local_admin=1" } }));
    assert.match(response.headers.get("location"), /calendar=processing/);
    assert.equal((await getCustomerBooking(bookingId)).status, "approval_processing");
  } finally { globalThis.fetch = original; }
});

test('response deadlines use the actual charge expiry and never assume seven days', async()=>{
  const {authorizationDeadline}=await import('../app/_lib/stripe-payments.ts');
  const now=Date.now(), created=new Date(now).toISOString(), start=now+7*86400000;
  const intent={...session('deadline').payment_intent,latest_charge:{payment_method_details:{type:'card',card:{capture_before:Math.floor((now+3*3600000)/1000)}}}};
  const result=authorizationDeadline(intent,created,start);
  assert.equal(result.respondBy,result.captureBefore-3600000);
  assert.ok(result.respondBy<now+24*3600000);
  assert.equal(authorizationDeadline({...intent,latest_charge:null},created,start).captureBefore,null);
  assert.equal(authorizationDeadline(intent,created,now+60000).respondBy,now+60000-1800000);
});

test('the shared booking fence rejects concurrent workers and recovers an abandoned lease',async()=>{
  const {withBookingLock}=await import('../app/_lib/booking-lock.ts');
  const id=seed('lease');
  sqlite.prepare('UPDATE customer_bookings SET workflow_lock=?,workflow_lock_until=? WHERE id=?').run('abandoned',Date.now()-1,id);
  await withBookingLock(id,async guard=>{
    await guard();
    await assert.rejects(()=>withBookingLock(id,async()=>{}),/being processed/);
    sqlite.prepare('UPDATE customer_bookings SET workflow_lock=? WHERE id=?').run('replacement',id);
    await assert.rejects(guard,/lease ended/);
  });
  assert.equal(sqlite.prepare('SELECT workflow_lock FROM customer_bookings WHERE id=?').get(id).workflow_lock,'replacement');
});

test('Zoom capacity reservations serialize different creators and expand to a second host',async()=>{
  const {reserveZoomHost}=await import('../app/_lib/zoom.ts');
  const first=seed('host-a'), second=seed('host-b');
  process.env.ZOOM_HOST_USER_IDS='["pool_a"]';
  const previous=globalThis.fetch;
  globalThis.fetch=async url=>Response.json(String(url).includes('/oauth/token')?{access_token:'fixture'}:{meetings:[]});
  try {
    const outcomes=await Promise.allSettled([first,second].map(async id=>reserveZoomHost(await getCustomerBooking(id))));
    assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);
    const loser=outcomes[0].status==='rejected'?first:second;
    process.env.ZOOM_HOST_USER_IDS='["pool_a","pool_b"]';
    assert.equal(await reserveZoomHost(await getCustomerBooking(loser)),'pool_b');
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM zoom_host_reservations WHERE host_id IN ('pool_a','pool_b')").get().n,2);
  } finally {globalThis.fetch=previous;}
});


test('a succeeded partial capture cannot confirm the full-priced booking through webhook replay',async()=>{
  const id='partialcapture'; seed(id);
  const paid=session(id,'complete','succeeded'); paid.payment_intent.amount_received=100;
  await withStripe(paid,async()=>{
    for(let attempt=0;attempt<2;attempt++) assert.equal((await event('payment_intent.succeeded',paid.payment_intent)).status,500);
    assert.equal((await getCustomerBooking(`booking_${id}`)).status,'requested');
  });
});
