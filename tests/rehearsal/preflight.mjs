// Read-only LOCAL rehearsal checks. Never writes to providers or prints secrets.
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

const env = parseEnv(await readFile(process.argv[2] || '.dev.vars', 'utf8'));
const required = [
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_BOOKING_PAYMENT_METHOD_CONFIGURATION',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_TOKEN_ENCRYPTION_KEY',
  'ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_USER_IDS',
  'RESEND_API_KEY', 'TAKE_A_SEAT_EMAIL_FROM', 'NEXT_PUBLIC_SITE_URL',
];
const placeholder = /replace_me|replace_with|e2e_fixture|sk_test_e2e|pmc_e2e/;
const missing = required.filter(name => !env[name]?.trim() || placeholder.test(env[name]));
const stripeTestKey = /^(rk|sk)_test_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY || '') && !placeholder.test(env.STRIPE_SECRET_KEY);
const clerkTestKeys = /^pk_test_/.test(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '') && /^sk_test_/.test(env.CLERK_SECRET_KEY || '');
let localOrigin = false;
try {
  const url = new URL(env.NEXT_PUBLIC_SITE_URL);
  localOrigin = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
} catch { /* Report invalid URL without echoing its contents. */ }
const report = { missing, localOrigin, stripeTestKey, clerkTestKeys, stripe: [], readyForProviderSetup: false,
  limits: 'Presence does not prove provider authentication, OAuth callbacks, webhook delivery, Connect writes or the complete journey.' };

async function readStripe(path, summarize) {
  try {
    const response = await fetch(`https://api.stripe.com${path}`, {
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Stripe-Version': '2026-08-26.dahlia' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return { path, ok: false, status: response.status };
    return { path, status: response.status, ...summarize(await response.json()) };
  } catch { return { path, ok: false, error: 'Network or response failure' }; }
}

// Refuse every API call if mode or origin is wrong.
if (stripeTestKey && localOrigin) {
  report.stripe.push(await readStripe('/v1/account', account => ({ ok: account.id === 'acct_1TcSNS1B3wHKPpd6' })));
  if (report.stripe[0].ok) {
    const config = env.STRIPE_BOOKING_PAYMENT_METHOD_CONFIGURATION;
    if (/^pmc_[A-Za-z0-9]+$/.test(config || '') && !placeholder.test(config)) {
      report.stripe.push(await readStripe(`/v1/payment_method_configurations/${encodeURIComponent(config)}`, config => {
        const enabled = Object.entries(config).filter(([, value]) => value?.display_preference?.value === 'on').map(([name]) => name);
        return { ok: config.livemode === false && config.active === true && enabled.length === 1 && enabled[0] === 'card',
          testMode: config.livemode === false, active: config.active, enabled };
      }));
    }
    report.stripe.push(await readStripe('/v2/core/accounts?limit=1', () => ({ ok: true })));
  }
}
report.readyForProviderSetup = !missing.length && clerkTestKeys && localOrigin && report.stripe.length === 3 && report.stripe.every(check => check.ok);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.readyForProviderSetup ? 0 : 1;
