import { eq } from "drizzle-orm";
import { creatorStripeConnections } from "../../db/schema";

export const STRIPE_API_VERSION = "2026-08-26.dahlia";
const STRIPE_API_BASE = "https://api.stripe.com";
const DEFAULT_CONNECT_COUNTRY = "US";
const TEST_STRIPE_CONNECTIONS_ENV = "TAKE_A_SEAT_TEST_STRIPE_CONNECTIONS";

type CreatorStripeConnection = typeof creatorStripeConnections.$inferSelect;

export type StripeAccountSummary = {
  id: string;
  livemode: boolean;
};

type StripeAccountDetails = StripeAccountSummary & {
  configuration?: {
    recipient?: {
      capabilities?: {
        stripe_balance?: {
          stripe_transfers?: {
            status?: string;
          };
        };
      };
    };
  };
};

type StripeApiError = {
  code?: string;
  message: string;
  status: number;
};

export class StripeConnectError extends Error {
  code?: string;
  status: number;

  constructor(error: StripeApiError) {
    super(error.message);
    this.code = error.code;
    this.status = error.status;
  }
}

export function getRuntimeEnv(name: string) {
  const globalEnv = (globalThis as Record<string, unknown>).env;
  const cloudflareValue =
    globalEnv && typeof globalEnv === "object"
      ? (globalEnv as Record<string, unknown>)[name]
      : undefined;
  const processValue = process.env[name];
  const value =
    typeof cloudflareValue === "string" ? cloudflareValue : processValue;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getStripeSecretKey() {
  const value = getRuntimeEnv("STRIPE_SECRET_KEY");

  if (!value || (!value.startsWith("sk_") && !value.startsWith("rk_"))) {
    return null;
  }

  return value;
}

export function getStripeWebhookSecret() {
  const value = getRuntimeEnv("STRIPE_WEBHOOK_SECRET");

  if (!value || !value.startsWith("whsec_")) {
    return null;
  }

  return value;
}

export function getConnectCountry() {
  return (getRuntimeEnv("STRIPE_CONNECT_COUNTRY") ?? DEFAULT_CONNECT_COUNTRY)
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

export function buildStripeReturnUrl(
  request: Request,
  path: string,
  creatorId: string,
  returnTo: string,
) {
  const configuredSiteUrl = getRuntimeEnv("NEXT_PUBLIC_SITE_URL");
  const baseUrl = configuredSiteUrl ?? new URL(request.url).origin;
  const target = new URL(path, baseUrl);
  target.searchParams.set("creatorId", creatorId);
  target.searchParams.set("returnTo", returnTo);
  return target.toString();
}

export async function getCreatorStripeConnection(creatorId: string) {
  const testConnection = getTestCreatorStripeConnection(creatorId);

  if (testConnection) {
    return testConnection;
  }

  const { getDb } = await import("../../db");
  const db = getDb();

  const [connection] = await db
    .select()
    .from(creatorStripeConnections)
    .where(eq(creatorStripeConnections.creatorId, creatorId))
    .limit(1);

  return connection ?? null;
}

function getTestCreatorStripeConnection(creatorId: string) {
  const rawValue = getRuntimeEnv(TEST_STRIPE_CONNECTIONS_ENV);

  if (!rawValue) {
    return null;
  }

  try {
    const connections = JSON.parse(rawValue) as CreatorStripeConnection[];
    return (
      connections.find((connection) => connection.creatorId === creatorId) ??
      null
    );
  } catch {
    return null;
  }
}

export async function saveCreatorStripeConnection({
  accountCountry,
  creatorId,
  dashboard,
  livemode,
  stripeAccountId,
}: {
  accountCountry: string;
  creatorId: string;
  dashboard: string;
  livemode: boolean;
  stripeAccountId: string;
}) {
  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .insert(creatorStripeConnections)
    .values({
      accountCountry,
      creatorId,
      dashboard,
      livemode,
      onboardingStartedAt: now,
      stripeAccountId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        accountCountry,
        dashboard,
        livemode,
        onboardingStartedAt: now,
        stripeAccountId,
        updatedAt: now,
      },
      target: creatorStripeConnections.creatorId,
    });
}

export async function markCreatorStripeReturned(creatorId: string) {
  const { getDb } = await import("../../db");
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .update(creatorStripeConnections)
    .set({ connectedAt: now, updatedAt: now })
    .where(eq(creatorStripeConnections.creatorId, creatorId));
}

export async function createConnectedAccount({
  contactEmail,
  country,
  creatorId,
  displayName,
  secretKey,
}: {
  contactEmail: string;
  country: string;
  creatorId: string;
  displayName: string;
  secretKey: string;
}) {
  return stripeJson<StripeAccountSummary>(
    "/v2/core/accounts",
    secretKey,
    {
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: {
                requested: true,
              },
            },
          },
        },
      },
      contact_email: contactEmail,
      dashboard: "express",
      defaults: {
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      display_name: displayName,
      identity: {
        country,
      },
      include: ["configuration.recipient", "identity", "requirements"],
      metadata: {
        creator_id: creatorId,
        integration: "take_a_seat_creator_onboarding",
      },
    },
    `take-a-seat-connect-account-${creatorId}`,
  );
}

export async function createAccountOnboardingLink({
  accountId,
  refreshUrl,
  returnUrl,
  secretKey,
}: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
  secretKey: string;
}) {
  return stripeJson<{ url: string }>(
    "/v2/core/account_links",
    secretKey,
    {
      account: accountId,
      use_case: {
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: refreshUrl,
          return_url: returnUrl,
        },
        type: "account_onboarding",
      },
    },
    `take-a-seat-connect-link-${accountId}-${crypto.randomUUID()}`,
  );
}

export async function getConnectedAccountTransferStatus({
  accountId,
  secretKey,
}: {
  accountId: string;
  secretKey: string;
}) {
  const params = new URLSearchParams({
    "include[0]": "configuration.recipient",
  });
  const account = await stripeGet<StripeAccountDetails>(
    `/v2/core/accounts/${encodeURIComponent(accountId)}?${params.toString()}`,
    secretKey,
  );

  return (
    account.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.status ?? null
  );
}

async function stripeJson<T extends object>(
  path: string,
  secretKey: string,
  body: Record<string, unknown>,
  idempotencyKey: string,
) {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      "Stripe-Version": STRIPE_API_VERSION,
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | T
    | null;

  if (!response.ok) {
    const error = payload && "error" in payload ? payload.error : null;
    throw new StripeConnectError({
      code: error?.code,
      message: error?.message ?? "Stripe Connect request failed.",
      status: response.status,
    });
  }

  return payload as T;
}

async function stripeGet<T extends object>(path: string, secretKey: string) {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Stripe-Version": STRIPE_API_VERSION,
    },
    method: "GET",
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | T
    | null;

  if (!response.ok) {
    const error = payload && "error" in payload ? payload.error : null;
    throw new StripeConnectError({
      code: error?.code,
      message: error?.message ?? "Stripe Connect request failed.",
      status: response.status,
    });
  }

  return payload as T;
}
