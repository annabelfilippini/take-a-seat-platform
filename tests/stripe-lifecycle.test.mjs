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
process.env.STRIPE_SECRET_KEY = "sk_test_lifecycle";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_lifecycle";
process.env.TAKE_A_SEAT_DEV_ADMIN_ENABLED = "true";

function seed(id) {
  const bookingId = `booking_${id}`;
  sqlite.prepare("INSERT INTO customer_bookings (id, creator_id, creator_name, seat_id, seat_name, customer_email, appointment_start_at, appointment_end_at, timezone, status, stripe_checkout_session_id) VALUES (?, 'test-creator', 'Test Creator', 'test-seat', '15 minutes', 'test@example.com', '2026-10-01T09:00:00', '2026-10-01T09:15:00', 'America/New_York', 'requested', ?)").run(bookingId, `cs_${id}`);
  return bookingId;
}
function session(id, status = "complete", intentStatus = "requires_capture") {
  return { id: `cs_${id}`, status, payment_status: intentStatus === "succeeded" ? "paid" : "unpaid",
    metadata: { booking_id: `booking_${id}` },
    payment_intent: { id: `pi_${id}`, status: intentStatus, capture_method: "manual", amount_capturable: intentStatus === "requires_capture" ? 5000 : 0, metadata: { booking_id: `booking_${id}` } } };
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
  const id = "processingcapture"; const bookingId = seed(id);
  await withStripe(session(id), async () => { await event("checkout.session.completed", session(id)); });
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ id: `pi_${id}`, status: "processing" });
  try {
    const response = await approve(new Request("http://localhost/api/bookings/approve", { method: "POST", body: new URLSearchParams({ bookingId }), headers: { cookie: "tas_local_admin=1" } }));
    assert.match(response.headers.get("location"), /detail=capture/);
    assert.equal((await getCustomerBooking(bookingId)).status, "payment_authorized");
  } finally { globalThis.fetch = original; }
});
