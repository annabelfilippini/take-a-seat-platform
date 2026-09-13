import type { CreatorProfileSettingsInput } from "./creator-onboarding";
import { formatBookingDateTime, type CustomerBooking } from "./bookings";
import { DEFAULT_ADMIN_EMAIL } from "./admin-auth";
import { CREATOR_PROFILE_EDITOR_URL } from "./creator-destination";
import { env as workerEnv } from "cloudflare:workers";

const RESEND_API_URL = "https://api.resend.com/emails";
const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

export type EmailResult =
  | { status: "sent" }
  | {
      reason:
        | "missing-from"
        | "missing-key"
        | "missing-recipient"
        | "request-failed"
        | "setup-link-failed";
      status: "skipped";
    };

type SmsResult =
  | { status: "sent" }
  | {
      reason:
        | "missing-account"
        | "missing-from"
        | "missing-key"
        | "request-failed";
      status: "skipped";
    };

type CreatorApplicationEmail = {
  creatorId: string;
  input: CreatorProfileSettingsInput;
  request: Request;
};

type CreatorAcceptedEmail = {
  signInToken?: string;
  creatorId: string;
  email: string;
  emailNonce: string;
  expiresAt: string;
  inviteToken: string;
  name: string;
  request: Request;
};

type CreatorApplicationReceivedEmail = {
  creatorId: string;
  input: CreatorProfileSettingsInput;
};

type CreatorAcceptedSms = {
  inviteToken?: string;
  name: string;
  request: Request;
  to: string;
};

type CreatorBookingNotification = {
  booking: CustomerBooking;
  request: Request;
  to: string;
};

export async function sendCreatorApplicationEmail({
  creatorId,
  input,
  request,
}: CreatorApplicationEmail): Promise<EmailResult> {
  const adminEmail = getApplicationRecipient();
  const queueUrl = buildAbsoluteUrl(request, "/admin/applications");
  const reviewUrl = buildAbsoluteUrl(request, `/admin/applications/${creatorId}`);
  const subject = `New Take a Seat application: ${input.name}`;
  const text = [
    "New Take a Seat creator application",
    "",
    `Open application queue: ${queueUrl}`,
    `Review application: ${reviewUrl}`,
    "",
    `Name: ${input.name}`,
    `Email: ${input.email || "Not provided"}`,
    `Phone: ${input.phone || "Not provided"}`,
    `Instagram/TikTok: ${input.instagramPlatform}`,
    `Category: ${input.category}`,
    "",
    "Expertise:",
    input.profileDetails,
    "",
    `Open application queue: ${queueUrl}`,
    `Review application: ${reviewUrl}`,
  ].join("\n");

  const html = [
    "<h1>New creator application</h1>",
    "<p>A creator applied to Take a Seat.</p>",
    `<p><a href="${escapeHtml(queueUrl)}">Open application queue</a></p>`,
    `<p><a href="${escapeHtml(reviewUrl)}">Review and accept application</a></p>`,
    "<ul>",
    `<li><strong>Name:</strong> ${escapeHtml(input.name)}</li>`,
    `<li><strong>Email:</strong> ${escapeHtml(input.email || "Not provided")}</li>`,
    `<li><strong>Phone:</strong> ${escapeHtml(input.phone || "Not provided")}</li>`,
    `<li><strong>Social:</strong> ${escapeHtml(input.instagramPlatform)}</li>`,
    `<li><strong>Category:</strong> ${escapeHtml(input.category)}</li>`,
    "</ul>",
    `<p><strong>Expertise:</strong><br>${escapeHtml(input.profileDetails).replace(/\n/g, "<br>")}</p>`,
    `<p><a href="${escapeHtml(queueUrl)}">Open application queue</a></p>`,
    `<p><a href="${escapeHtml(reviewUrl)}">Review and accept application</a></p>`,
  ].join("");

  return sendEmail({
    idempotencyKey: `take-a-seat-application-${creatorId}`,
    html,
    replyTo: input.email || undefined,
    subject,
    text,
    to: adminEmail,
  });
}

export async function sendCreatorApplicationReceivedEmail({
  creatorId,
  input,
}: CreatorApplicationReceivedEmail): Promise<EmailResult> {
  if (!input.email || !input.email.includes("@")) {
    return { reason: "missing-recipient", status: "skipped" };
  }

  const subject = "We received your Take a Seat application";
  const text = [
    "Thank you for applying to Take a Seat!",
    "",
    "We received your Take a Seat creator application.",
    "",
    "If your application is accepted, you will receive a setup link to sign in and start building your profile!",
    "",
    "Annabel",
  ].join("\n");
  const html = [
    "<p>Thank you for applying to Take a Seat!</p>",
    "<p>We received your Take a Seat creator application.</p>",
    "<p>If your application is accepted, you will receive a setup link to sign in and start building your profile!</p>",
    "<p>Annabel</p>",
  ].join("");

  return sendEmail({
    idempotencyKey: `take-a-seat-application-received-${creatorId}`,
    html,
    subject,
    text,
    to: input.email,
  });
}

export async function sendCreatorAcceptedEmail({
  creatorId,
  email,
  emailNonce,
  inviteToken,
  request,
  signInToken,
}: CreatorAcceptedEmail): Promise<EmailResult> {
  const setupUrl = buildAbsoluteUrl(
    request,
    signInToken
      ? `/creators/email-sign-in?invite=${encodeURIComponent(inviteToken)}#${new URLSearchParams({ ticket: signInToken, email }).toString()}`
      : `${CREATOR_PROFILE_EDITOR_URL}?invite=${encodeURIComponent(inviteToken)}`,
  );
  const subject = "Congratulations! You've been accepted into Take a Seat";
  const text = [
    "Hi!",
    "",
    "Congratulations! You've been accepted into Take a Seat. Click this link to start working on your profile.",
    "",
    `Start working on your profile: ${setupUrl}`,
    "Sign in with the email address from your accepted application.",
    "",
    "Save your profile when you are ready for your card to appear on the website.",
    "",
    "We can’t wait for you to begin inspiring!!!",
    "",
    "Annabel",
  ].join("\n");
  const html = [
    "<p>Hi!</p>",
    "<p>Congratulations! You've been accepted into Take a Seat. Click this link to start working on your profile.</p>",
    `<p><a href="${escapeHtml(setupUrl)}">Start working on your profile</a></p>`,
    "<p>Sign in with the email address from your accepted application.</p>",
    "<p>Save your profile when you are ready for your card to appear on the website.</p>",
    "<p>We can’t wait for you to begin inspiring!!!</p>",
    "<p>Annabel</p>",
  ].join("");

  return sendEmail({
    idempotencyKey: `take-a-seat-accepted-${creatorId}-${emailNonce}`,
    html,
    subject,
    text,
    to: email,
  });
}

export async function sendCreatorAcceptedSms({
  inviteToken,
  name,
  request,
  to,
}: CreatorAcceptedSms): Promise<SmsResult> {
  const setupPath = inviteToken
    ? `${CREATOR_PROFILE_EDITOR_URL}?invite=${encodeURIComponent(inviteToken)}`
    : CREATOR_PROFILE_EDITOR_URL;
  const setupUrl = buildAbsoluteUrl(request, setupPath);
  const firstName = name.trim().split(/\s+/u)[0] || "there";

  return sendSms({
    body: `Hi ${firstName}, your Take a Seat application was accepted. Build your profile: ${setupUrl}`,
    to,
  });
}

export async function sendCreatorBookingEmail({
  booking,
  request,
  to,
}: CreatorBookingNotification): Promise<EmailResult> {
  const bookingUrl = buildAbsoluteUrl(
    request,
    `/bookings/${encodeURIComponent(booking.id)}`,
  );
  const customerLabel = booking.customerName ?? booking.customerEmail;
  const subject = `New Take a Seat booking: ${booking.seatName}`;
  const text = [
    `You have a new paid Take a Seat booking with ${customerLabel}.`,
    "",
    `Seat: ${booking.seatName}`,
    `When: ${formatBookingDateTime(booking)}`,
    `Customer email: ${booking.customerEmail}`,
    booking.customerNote ? `Customer note: ${booking.customerNote}` : null,
    "",
    `Review booking: ${bookingUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = [
    "<h1>New paid booking</h1>",
    `<p>You have a new paid Take a Seat booking with ${escapeHtml(customerLabel)}.</p>`,
    "<ul>",
    `<li><strong>Seat:</strong> ${escapeHtml(booking.seatName)}</li>`,
    `<li><strong>When:</strong> ${escapeHtml(formatBookingDateTime(booking))}</li>`,
    `<li><strong>Customer email:</strong> ${escapeHtml(booking.customerEmail)}</li>`,
    booking.customerNote
      ? `<li><strong>Customer note:</strong> ${escapeHtml(booking.customerNote)}</li>`
      : null,
    "</ul>",
    `<p><a href="${escapeHtml(bookingUrl)}">Review booking</a></p>`,
  ]
    .filter(Boolean)
    .join("");

  return sendEmail({
    idempotencyKey: `take-a-seat-booking-paid-${booking.id}`,
    html,
    replyTo: booking.customerEmail,
    subject,
    text,
    to,
  });
}

export async function sendCreatorBookingSms({
  booking,
  request,
  to,
}: CreatorBookingNotification): Promise<SmsResult> {
  return sendSms({
    body: `New Take a Seat booking: ${booking.seatName} with ${booking.customerName ?? booking.customerEmail} on ${formatBookingDateTime(booking)}. ${buildAbsoluteUrl(
      request,
      `/bookings/${encodeURIComponent(booking.id)}`,
    )}`,
    to,
  });
}

export async function sendCreatorBookingRequestEmail({
  booking,
  request,
  to,
}: CreatorBookingNotification): Promise<EmailResult> {
  const bookingUrl = buildAbsoluteUrl(
    request,
    `/bookings/${encodeURIComponent(booking.id)}`,
  );
  const customerLabel = booking.customerName ?? booking.customerEmail;
  const subject = `New Take a Seat request: ${booking.seatName}`;
  const text = [
    `${customerLabel} requested a Take a Seat call with you.`,
    "",
    `Seat: ${booking.seatName}`,
    `Requested time: ${formatBookingDateTime(booking)}`,
    `Customer email: ${booking.customerEmail}`,
    booking.customerNote ? `Customer note: ${booking.customerNote}` : null,
    "",
    `Review request: ${bookingUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = [
    "<h1>New booking request</h1>",
    `<p>${escapeHtml(customerLabel)} requested a Take a Seat call with you.</p>`,
    "<ul>",
    `<li><strong>Seat:</strong> ${escapeHtml(booking.seatName)}</li>`,
    `<li><strong>Requested time:</strong> ${escapeHtml(formatBookingDateTime(booking))}</li>`,
    `<li><strong>Customer email:</strong> ${escapeHtml(booking.customerEmail)}</li>`,
    booking.customerNote
      ? `<li><strong>Customer note:</strong> ${escapeHtml(booking.customerNote)}</li>`
      : null,
    "</ul>",
    `<p><a href="${escapeHtml(bookingUrl)}">Review request</a></p>`,
  ]
    .filter(Boolean)
    .join("");

  return sendEmail({
    idempotencyKey: `take-a-seat-booking-request-${booking.id}`,
    html,
    replyTo: booking.customerEmail,
    subject,
    text,
    to,
  });
}

export async function sendCreatorBookingRequestSms({
  booking,
  request,
  to,
}: CreatorBookingNotification): Promise<SmsResult> {
  return sendSms({
    body: `New Take a Seat request: ${booking.seatName} with ${booking.customerName ?? booking.customerEmail} on ${formatBookingDateTime(booking)}. ${buildAbsoluteUrl(
      request,
      `/bookings/${encodeURIComponent(booking.id)}`,
    )}`,
    to,
  });
}

async function sendSms({
  body,
  to,
}: {
  body: string;
  to: string;
}): Promise<SmsResult> {
  const accountSid = getRuntimeEnv("TWILIO_ACCOUNT_SID");
  const authToken = getRuntimeEnv("TWILIO_AUTH_TOKEN");
  const messagingServiceSid = getRuntimeEnv("TWILIO_MESSAGING_SERVICE_SID");
  const from = getRuntimeEnv("TWILIO_FROM_PHONE_NUMBER");

  if (!accountSid) {
    return { reason: "missing-account", status: "skipped" };
  }

  if (!authToken) {
    return { reason: "missing-key", status: "skipped" };
  }

  if (!messagingServiceSid && !from) {
    return { reason: "missing-from", status: "skipped" };
  }

  const params = new URLSearchParams({
    Body: body,
    To: to,
  });

  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else if (from) {
    params.set("From", from);
  }

  const response = await fetch(
    `${TWILIO_API_BASE}/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      body: params,
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    },
  ).catch(() => null);

  if (!response?.ok) {
    return { reason: "request-failed", status: "skipped" };
  }

  return { status: "sent" };
}

async function sendEmail({
  html,
  idempotencyKey,
  replyTo,
  subject,
  text,
  to,
}: {
  html: string;
  idempotencyKey: string;
  replyTo?: string;
  subject: string;
  text: string;
  to: string;
}): Promise<EmailResult> {
  const apiKey = getRuntimeEnv("RESEND_API_KEY");
  const from = getRuntimeEnv("TAKE_A_SEAT_EMAIL_FROM");

  if (!apiKey) {
    return { reason: "missing-key", status: "skipped" };
  }

  if (!from) {
    return { reason: "missing-from", status: "skipped" };
  }

  const response = await fetch(RESEND_API_URL, {
    body: JSON.stringify({
      from,
      html,
      reply_to: replyTo,
      subject,
      text,
      to: [to],
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    method: "POST",
  }).catch(() => null);

  if (!response?.ok) {
    return { reason: "request-failed", status: "skipped" };
  }

  return { status: "sent" };
}

function getApplicationRecipient() {
  return getRuntimeEnv("TAKE_A_SEAT_APPLICATION_RECIPIENT") ?? DEFAULT_ADMIN_EMAIL;
}

function buildAbsoluteUrl(request: Request, path: string) {
  const siteUrl =
    getRuntimeEnv("NEXT_PUBLIC_SITE_URL") ?? getRuntimeEnv("PUBLIC_SITE_URL");
  const origin = siteUrl ? new URL(siteUrl).origin : new URL(request.url).origin;

  return new URL(path, origin).toString();
}

function getRuntimeEnv(name: string) {
  const globalEnv = (globalThis as Record<string, unknown>).env;
  const globalValue =
    globalEnv && typeof globalEnv === "object"
      ? (globalEnv as Record<string, unknown>)[name]
      : undefined;
  const workerValue = (workerEnv as unknown as Record<string, unknown>)[name];
  const processValue =
    typeof process === "object" && process.env ? process.env[name] : undefined;
  const value =
    typeof globalValue === "string"
      ? globalValue
      : typeof workerValue === "string"
        ? workerValue
        : processValue;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
