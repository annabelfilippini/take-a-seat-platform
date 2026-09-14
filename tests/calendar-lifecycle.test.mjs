import assert from "node:assert/strict";
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
globalThis.__lifecycleEnv = { DB: {
        prepare,
        async batch(statements) {
            sqlite.exec("BEGIN");
            try {
                const results = [];
                for (const statement of statements)
                    results.push(await statement.all());
                sqlite.exec("COMMIT");
                return results;
            }
            catch (error) {
                sqlite.exec("ROLLBACK");
                throw error;
            }
        },
    } };
registerHooks({
    resolve(specifier, context, next) {
        if (specifier === "cloudflare:workers")
            return { url: "data:text/javascript,export const env = globalThis.__lifecycleEnv", shortCircuit: true };
        if (specifier === "next/headers")
            return { url: "data:text/javascript,export const headers = () => new Headers()", shortCircuit: true };
        if (specifier.startsWith(".")) {
            const base = fileURLToPath(new URL(specifier, context.parentURL));
            for (const suffix of [".ts", ".tsx", "/index.ts"]) {
                if (existsSync(base + suffix))
                    return { url: pathToFileURL(base + suffix).href, shortCircuit: true };
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
const domain = await import("../app/_lib/creator-onboarding.ts");
const { POST: submit } = await import("../app/api/creators/profile/route.ts");
const { POST: accept } = await import("../app/api/creators/applications/accept/route.ts");
const { GET: callback } = await import("../app/api/google-calendar/oauth/callback/route.ts");
const { GET: start } = await import("../app/api/google-calendar/oauth/start/route.ts");
const { POST: requestBooking } = await import("../app/api/bookings/request/route.ts");
const { POST: approve } = await import("../app/api/bookings/approve/route.ts");
const { POST: webhook } = await import("../app/api/stripe/webhook/route.ts");
const { encryptToken, decryptToken } = await import("../app/_lib/token-encryption.ts");
const { createOAuthState, getGoogleRedirectUri } = await import("../app/api/google-calendar/oauth/shared.ts");
const calendar = await import("../app/_lib/google-calendar.ts");
const bookingDomain = await import("../app/_lib/bookings.ts");
const { withSecureOrigin } = await import("../app/_lib/secure-origin.ts");
const { getSafeReturnTo } = await import("../app/_lib/safe-redirect.ts");
const { createHmac } = await import("node:crypto");
Object.assign(process.env, { TAKE_A_SEAT_DEV_ADMIN_ENABLED: "true", GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-client-secret", GOOGLE_TOKEN_ENCRYPTION_KEY: "test-encryption", STRIPE_SECRET_KEY: "sk_test_rehearsal", STRIPE_WEBHOOK_SECRET: "whsec_rehearsal", TAKE_A_SEAT_PLATFORM_FEE_BPS: "1500", RESEND_API_KEY: "test-resend", TAKE_A_SEAT_EMAIL_FROM: "Take a Seat <test@example.com>" });
const originalFetch = globalThis.fetch;
const emails = [], googleEvents = new Map();
let busy = [], refreshFails = false, conferencePending = false, inserts = 0, captures = 0;
const sessions = new Map();
async function provider(url, options = {}) {
    const target = String(url);
    if (target === "https://api.resend.com/emails") {
        emails.push(JSON.parse(options.body));
        return Response.json({ id: "test-email" });
    }
    if (target === "https://oauth2.googleapis.com/token") {
        if (refreshFails)
            return Response.json({ error: "invalid_grant" }, { status: 400 });
        return Response.json({ access_token: "fresh-access", refresh_token: "refresh-token", expires_in: 3600, scope: "https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events.owned" });
    }
    if (target.endsWith("/freeBusy"))
        return Response.json({ calendars: { primary: { busy } } });
    if (target.includes("www.googleapis.com/calendar/v3/calendars/primary/events")) {
        if (options.method === "POST") {
            const body = JSON.parse(options.body);
            assert.match(body.id, /^[0-9a-v]{5,1024}$/);
            assert.equal(new URL(target).searchParams.get("sendUpdates"), "all");
            if (googleEvents.has(body.id))
                return Response.json({}, { status: 409 });
            const event = { ...body, conferenceData: conferencePending ? { createRequest: { status: { statusCode: "pending" } } } : { createRequest: { status: { statusCode: "success" } }, entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/test-meet-link" }] }, htmlLink: "https://calendar.google.com/calendar/event?eid=test" };
            googleEvents.set(body.id, event);
            inserts++;
            return Response.json(event);
        }
        return Response.json(googleEvents.get(target.split("/").at(-1)));
    }
    if (target.includes("/v2/core/accounts/"))
        return Response.json({ configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: "active" } } } } } });
    if (target.endsWith("/v1/checkout/sessions")) {
        const params = options.body;
        assert.equal(params.get("payment_intent_data[capture_method]"), "manual");
        assert.equal(params.get("payment_intent_data[application_fee_amount]"), "750");
        const id = params.get("client_reference_id"), sid = "cs_" + id;
        const session = { id: sid, status: "complete", payment_status: "unpaid", metadata: { booking_id: id }, payment_intent: { id: "pi_" + id, status: "requires_capture", capture_method: "manual", amount_capturable: 5000, metadata: { booking_id: id } } };
        sessions.set(sid, session);
        return Response.json({ id: sid, url: "https://checkout.stripe.com/c/pay/" + sid });
    }
    if (target.includes("/v1/checkout/sessions/")) {
        const found = sessions.get(target.split("/").at(-1).split("?")[0]);
        return Response.json(found);
    }
    if (target.endsWith("/capture")) {
        captures++;
        return Response.json({ id: target.split("/").at(-2), status: "succeeded" });
    }
    if (target.includes("/v1/payment_intents/"))
        return Response.json([...sessions.values()].find(s => s.payment_intent.id === target.split("/").at(-1))?.payment_intent);
    throw new Error("Unexpected provider call: " + target);
}
function form(path, values, admin = false) { return new Request("http://localhost" + path, { method: "POST", body: new URLSearchParams(values), headers: { accept: "application/json", ...(admin ? { cookie: "tas_local_admin=1" } : {}) } }); }
async function connect(creatorId, expires = Date.now() + 3600000) {
    sqlite.prepare("INSERT OR REPLACE INTO creator_calendar_connections(creator_id,scopes,access_token_encrypted,refresh_token_encrypted,expires_at) VALUES(?,?,?,?,?)")
        .run(creatorId, "calendar", await encryptToken("access", process.env.GOOGLE_TOKEN_ENCRYPTION_KEY), await encryptToken("refresh", process.env.GOOGLE_TOKEN_ENCRYPTION_KEY), expires);
}
function seedBooking(id, creatorId, status = "paid") {
    sqlite.prepare("INSERT INTO customer_bookings(id,creator_id,creator_name,seat_id,seat_name,customer_email,appointment_start_at,appointment_end_at,timezone,status,stripe_checkout_session_id,stripe_payment_intent_id) VALUES(?,?,'QA','qa15','15 minutes','qa@example.com','2026-10-01T09:00:00','2026-10-01T09:15:00','America/New_York',?,?,?)").run(id, creatorId, status, "cs_" + id, "pi_" + id);
}
test("saved v1 tokens roundtrip and reject a changed key or ciphertext", async () => {
    const token = await encryptToken("private-token", "key");
    assert.equal(await decryptToken(token, "key"), "private-token");
    await assert.rejects(() => decryptToken(token, "wrong-key"));
    await assert.rejects(() => decryptToken(token.replace("v1.", "v2."), "key"));
    assert.equal(getGoogleRedirectUri(new Request("https://takeaseatwith.com/api/google-calendar/oauth/start")), "https://takeaseatwith.com/api/google-calendar/oauth/callback");
});
test("application, invitation, saved profile, OAuth, reservation, authorization, capture and calendar confirmation", async () => {
    globalThis.fetch = provider;
    try {
        const values = { name: "Rehearsal Creator", email: "rehearsal@example.com", phone: "+15555550123", profileDetails: "Test advice", reviewSubmittedAt: "true" };
        assert.equal((await submit(form("/api/creators/profile", values))).status, 200);
        assert.equal(emails.length, 2);
        const profile = (await domain.listCreatorApplications())[0];
        await accept(form("/api/creators/applications/accept", { creatorId: profile.id, publicCreatorId: "rehearsal-creator" }, true));
        const inviteUrl = new URL(emails.at(-1).text.match(/https?:\/\/\S+\?invite=\S+/)[0]);
        const owner = { userId: "user_rehearsal", email: values.email, phone: null, sessionId: "session_rehearsal" };
        assert.equal((await domain.claimCreatorInvite(inviteUrl.searchParams.get("invite"), owner)).status, "claimed");
        const saved = await submit(form("/api/creators/profile", { ...values, creatorId: (await domain.getCreatorDashboardAccount(owner)).profile.id, reviewSubmittedAt: "false", seat15Enabled: "on", seat15PriceAmount: "50", seat15DurationMinutes: "15" }, true));
        assert.equal(saved.status, 200, await saved.clone().text());
        const creator = await domain.getPublishedCreatorBySlug("rehearsal-creator");
        assert.ok(creator);
        await domain.saveCreatorAvailability({ creatorId: creator.id, timezone: "America/New_York", bufferMinutes: 15, minNoticeMinutes: 0, maxBookingsPerDay: null, maxBookingsPerWeek: null, rules: [{ dayOfWeek: 4, startTime: "09:00", endTime: "12:00" }] });
        const started = await start(new Request("http://localhost/api/google-calendar/oauth/start?creatorId=" + creator.id + "&returnTo=/creators/dashboard", { headers: { cookie: "tas_local_admin=1" } }));
        assert.equal(started.status, 303);
        const oauth = new URL(started.headers.get("location"));
        const callbackUrl = new URL(oauth.searchParams.get("redirect_uri"));
        callbackUrl.searchParams.set("state", oauth.searchParams.get("state"));
        callbackUrl.searchParams.set("code", "local-test-code");
        const connected = await callback(new Request(callbackUrl, { headers: { cookie: started.headers.get("set-cookie").split(";")[0] } }));
        assert.match(connected.headers.get("location"), /calendar=connected/);
        sqlite.prepare("INSERT INTO creator_stripe_connections(creator_id,stripe_account_id,account_country,connected_at) VALUES(?,'acct_test','US','2026-09-01')").run(creator.id);
        const requested = await requestBooking(form("/api/bookings/request", { creatorId: creator.id, seatId: creator.seats[0].id, appointmentStartAt: "2026-10-01T09:00:00", timezone: "America/New_York", customerEmail: "buyer@example.com", customerName: "Test Buyer", customerNote: "Wants to talk about: Outfit advice" }));
        assert.match(requested.headers.get("location"), /^https:\/\/checkout.stripe.com/);
        const session = [...sessions.values()].at(-1);
        assert.ok(session);
        // The compact guest form needs no phone or social handle. Keep its
        // name, topic, and creator-local timestamp intact through reservation.
        const reserved = await bookingDomain.getCustomerBooking(session.metadata.booking_id);
        assert.equal(reserved.customerName, "Test Buyer");
        assert.equal(reserved.customerNote, "Wants to talk about: Outfit advice");
        assert.equal(reserved.appointmentStartAt, "2026-10-01T09:00:00");
        assert.equal(reserved.timezone, "America/New_York");
        const timestamp = Math.floor(Date.now() / 1000), body = JSON.stringify({ type: "checkout.session.completed", data: { object: session } });
        const sig = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest("hex");
        assert.equal((await webhook(new Request("http://localhost/api/stripe/webhook", { method: "POST", body, headers: { "stripe-signature": `t=${timestamp},v1=${sig}` } }))).status, 200);
        assert.equal((await bookingDomain.getCustomerBooking(session.metadata.booking_id)).status, "payment_authorized");
        const response = await approve(form("/api/bookings/approve", { bookingId: session.metadata.booking_id }, true));
        assert.match(response.headers.get("location"), /calendar=sent/);
        const booking = await bookingDomain.getCustomerBooking(session.metadata.booking_id);
        assert.equal(booking.status, "approved");
        assert.ok(booking.googleCalendarEventId);
        assert.equal(captures, 1);
        assert.equal(inserts, 1);
        await approve(form("/api/bookings/approve", { bookingId: booking.id }, true));
        assert.equal(captures, 1);
        assert.equal(inserts, 1);
        assert.equal(googleEvents.get(booking.googleCalendarEventId).attendees[0].email, "buyer@example.com");
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test("expired calendar tokens refresh and retry reuses the original event after persistence failure", async () => {
    await connect("refresh-creator", Date.now() - 1);
    seedBooking("booking_refresh", "refresh-creator");
    globalThis.fetch = provider;
    try {
        const before = inserts;
        await calendar.approveBookingAndSendGoogleInvite("booking_refresh");
        assert.equal(inserts, before + 1);
        const token = sqlite.prepare("SELECT access_token_encrypted FROM creator_calendar_connections WHERE creator_id='refresh-creator'").get();
        assert.equal(await decryptToken(token.access_token_encrypted, process.env.GOOGLE_TOKEN_ENCRYPTION_KEY), "fresh-access");
        sqlite.prepare("UPDATE customer_bookings SET status='paid',google_calendar_event_id=NULL WHERE id='booking_refresh'").run();
        await calendar.approveBookingAndSendGoogleInvite("booking_refresh");
        assert.equal(inserts, before + 1);
        assert.equal((await bookingDomain.getCustomerBooking("booking_refresh")).status, "approved");
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test("missing/revoked calendars and external conflicts prevent capture", async () => {
    seedBooking("booking_unconnected", "unconnected", "payment_authorized");
    await connect("revoked", Date.now() - 1);
    seedBooking("booking_revoked", "revoked", "payment_authorized");
    await connect("busy");
    seedBooking("booking_busy", "busy", "payment_authorized");
    globalThis.fetch = provider;
    try {
        const before = captures;
        for (const id of ["booking_unconnected", "booking_revoked", "booking_busy"]) {
            refreshFails = id === "booking_revoked";
            busy = id === "booking_busy" ? [{ start: "2026-10-01T13:00:00Z", end: "2026-10-01T13:15:00Z" }] : [];
            const response = await approve(form("/api/bookings/approve", { bookingId: id }, true));
            assert.doesNotMatch(response.headers.get("location"), /calendar=sent/);
            assert.equal((await bookingDomain.getCustomerBooking(id)).status, "payment_authorized");
        }
        assert.equal(captures, before);
    }
    finally {
        globalThis.fetch = originalFetch;
        refreshFails = false;
        busy = [];
    }
});
test("a simultaneous reservation gets at most one checkout hold", async () => {
    const creator = { id: "race", name: "Race", availabilityRules: [{ dayOfWeek: 4, startTime: "09:00", endTime: "12:00", timezone: "America/New_York", bufferMinutes: 15, minNoticeMinutes: 0 }] }, seat = { id: "qa", name: "15 minutes" }, input = { appointmentStartAt: "2026-10-01T09:00:00", timezone: "America/New_York", customerEmail: "qa@example.com", customerName: null, customerNote: null };
    await connect(creator.id);
    globalThis.fetch = provider;
    try {
        const result = await Promise.all([1, 2].map(() => bookingDomain.reserveBookingRequest({ creator, seat, input })));
        assert.equal(result.filter(Boolean).length, 1);
        assert.equal(await bookingDomain.reserveBookingRequest({ creator, seat, input }), null);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test("OAuth rejects wrong cookies and cancelled consent without storing a connection", async () => {
    const state = await createOAuthState({ creatorId: "rejected", nonce: "expected", returnTo: "/creators/dashboard", expiresAt: Date.now() + 60000 }, process.env.GOOGLE_CLIENT_SECRET);
    for (const [cookie, extra, expected] of [["wrong", "code=test", "state-cookie"], ["expected", "error=access_denied", "calendar=cancelled"]]) {
        const response = await callback(new Request(`http://localhost/api/google-calendar/oauth/callback?state=${state}&${extra}`, { headers: { cookie: `tas_google_oauth_nonce=${cookie}` } }));
        assert.ok(response.headers.get("location").includes(expected));
    }
    assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM creator_calendar_connections WHERE creator_id='rejected'").get().n, 0);
});
test("safe redirects, invalid booking bodies and HTTPS preserve the intended destination", async () => {
    for (const value of ["//example.com", "/\\example.com", "/\n/example.com"]) {
        assert.equal(getSafeReturnTo(value, "/"), "/");
    }
    for (const body of ["{", "null", "[]"]) {
        const response = await requestBooking(new Request("http://localhost/api/bookings/request", { method: "POST", body, headers: { "content-type": "application/json" } }));
        assert.equal(response.status, 400);
    }
    const response = await withSecureOrigin(new Request("http://takeaseatwith.com/creators/dashboard?invite=test"), () => { throw new Error("Must upgrade first"); });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "https://takeaseatwith.com/creators/dashboard?invite=test");
});
test("pending Meet creation stays paid and retry confirms the same event", async () => {
    await connect("pending");
    seedBooking("booking_pending", "pending");
    globalThis.fetch = provider;
    conferencePending = true;
    try {
        const before = inserts;
        await assert.rejects(() => calendar.approveBookingAndSendGoogleInvite("booking_pending"), /Meet is not ready/);
        assert.equal((await bookingDomain.getCustomerBooking("booking_pending")).status, "paid");
        const id = await calendar.getBookingEventId("booking_pending");
        googleEvents.get(id).conferenceData = { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/test-meet-link" }] };
        await calendar.approveBookingAndSendGoogleInvite("booking_pending");
        assert.equal(inserts, before + 1);
        assert.equal((await bookingDomain.getCustomerBooking("booking_pending")).status, "approved");
    }
    finally {
        globalThis.fetch = originalFetch;
        conferencePending = false;
    }
});
test("busy buffers and provider errors fail closed before reserving a checkout", async () => {
    const creator = { id: "buffer", name: "Buffer", availabilityRules: [{ dayOfWeek: 4, startTime: "09:00", endTime: "12:00", timezone: "America/New_York", bufferMinutes: 15, minNoticeMinutes: 0 }] };
    const seat = { id: "qa", name: "15 minutes" }, input = { appointmentStartAt: "2026-10-01T09:00:00", timezone: "America/New_York", customerEmail: "qa@example.com", customerName: null, customerNote: null };
    await connect(creator.id);
    globalThis.fetch = provider;
    try {
        busy = [{ start: "2026-10-01T12:50:00Z", end: "2026-10-01T12:55:00Z" }];
        assert.equal(await bookingDomain.reserveBookingRequest({ creator, seat, input }), null);
        globalThis.fetch = async () => Response.json({ calendars: { primary: { errors: [{ reason: "forbidden" }] } } });
        await assert.rejects(() => bookingDomain.reserveBookingRequest({ creator, seat, input }), /could not be verified/);
        assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM customer_bookings WHERE creator_id='buffer'").get().n, 0);
    }
    finally {
        globalThis.fetch = originalFetch;
        busy = [];
    }
});
test("partial OAuth permission does not become a connected calendar", async () => {
    const state = await createOAuthState({ creatorId: "partial", nonce: "expected", returnTo: "/creators/dashboard", expiresAt: Date.now() + 60000 }, process.env.GOOGLE_CLIENT_SECRET);
    globalThis.fetch = async () => Response.json({ access_token: "test", expires_in: 3600, scope: "https://www.googleapis.com/auth/calendar.freebusy" });
    try {
        const response = await callback(new Request(`http://localhost/api/google-calendar/oauth/callback?state=${state}&code=test`, { headers: { cookie: "tas_google_oauth_nonce=expected" } }));
        assert.match(response.headers.get("location"), /calendar-permissions/);
        assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM creator_calendar_connections WHERE creator_id='partial'").get().n, 0);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
test("a delayed Checkout webhook cannot expose the held time to a second customer", async () => {
    const creator = { id: "delayed", name: "Delayed", availabilityRules: [{ dayOfWeek: 4, startTime: "09:00", endTime: "12:00", timezone: "America/New_York", bufferMinutes: 0, minNoticeMinutes: 0 }] };
    const seat = { id: "qa15", name: "15 minutes" }, input = { appointmentStartAt: "2026-10-01T09:00:00", timezone: "America/New_York", customerEmail: "qa@example.com", customerName: null, customerNote: null };
    seedBooking("booking_delayed", creator.id, "requested");
    sqlite.prepare("UPDATE customer_bookings SET created_at='2026-01-01' WHERE id='booking_delayed'").run();
    assert.equal(await bookingDomain.isBookingSlotAvailable({ creator, seat, input }), false);
    sqlite.prepare("UPDATE customer_bookings SET status='checkout_expired' WHERE id='booking_delayed'").run();
    assert.equal(await bookingDomain.isBookingSlotAvailable({ creator, seat, input }), true);
});
