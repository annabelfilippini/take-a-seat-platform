"use client";

import { useState } from "react";

type InitialStatuses = {
  availability: string | null;
  calendar: string | null;
  creatorEmail: string | null;
  creatorEmailDetail: string | null;
  profile: string | null;
  stripe: string | null;
};

export function CreatorOnboardingForm({
  initialStatuses,
}: {
  initialStatuses?: InitialStatuses;
}) {
  const statuses = initialStatuses ?? {
    availability: null,
    calendar: null,
    creatorEmail: null,
    creatorEmailDetail: null,
    profile: null,
    stripe: null,
  };
  const [profileStatus] = useState(statuses.profile);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [expertise, setExpertise] = useState("");

  const name = `${firstName} ${lastName}`.trim();

  return (
    <section className="creator-apply-stage">
      {profileStatus === "error" || profileStatus === "setup-needed" ? (
        <p className="booking-notice">
          Application save needs attention. Please try again, or check the local
          D1 setup.
        </p>
      ) : null}

      {profileStatus === "saved" ? (
        <ReviewState
          creatorEmailDetail={statuses.creatorEmailDetail}
          creatorEmailStatus={statuses.creatorEmail}
        />
      ) : (
        <div className="creator-application-layout">
          <h1>Apply to Inspire</h1>
          <ApplicationForm
            email={email}
            expertise={expertise}
            firstName={firstName}
            instagramHandle={instagramHandle}
            lastName={lastName}
            name={name}
            phone={phone}
            setEmail={setEmail}
            setExpertise={setExpertise}
            setFirstName={setFirstName}
            setInstagramHandle={setInstagramHandle}
            setLastName={setLastName}
            setPhone={setPhone}
            setTiktokHandle={setTiktokHandle}
            tiktokHandle={tiktokHandle}
          />
        </div>
      )}
    </section>
  );
}

function ApplicationForm({
  email,
  expertise,
  firstName,
  instagramHandle,
  lastName,
  name,
  phone,
  setEmail,
  setExpertise,
  setFirstName,
  setInstagramHandle,
  setLastName,
  setPhone,
  setTiktokHandle,
  tiktokHandle,
}: {
  email: string;
  expertise: string;
  firstName: string;
  instagramHandle: string;
  lastName: string;
  name: string;
  phone: string;
  setEmail: (value: string) => void;
  setExpertise: (value: string) => void;
  setFirstName: (value: string) => void;
  setInstagramHandle: (value: string) => void;
  setLastName: (value: string) => void;
  setPhone: (value: string) => void;
  setTiktokHandle: (value: string) => void;
  tiktokHandle: string;
}) {
  const primarySocialHandle = instagramHandle.trim() || tiktokHandle.trim();

  return (
    <form
      action="/api/creators/profile"
      className="creator-application-form"
      method="post"
    >
      <input name="category" type="hidden" value="Style & Beauty" />
      <input name="currency" type="hidden" value="USD" />
      <input name="instagramPlatform" type="hidden" value={primarySocialHandle} />
      <input name="location" type="hidden" value="" />
      <input name="name" type="hidden" value={name} />
      <input name="reviewSubmittedAt" type="hidden" value="true" />
      <input name="seat15DurationMinutes" type="hidden" value="15" />
      <input name="seat30DurationMinutes" type="hidden" value="30" />
      <input name="timezone" type="hidden" value="America/Los_Angeles" />

      <div className="creator-apply-grid">
        <label>
          <span>First name</span>
          <input
            autoComplete="given-name"
            name="firstName"
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="First name"
            value={firstName}
          />
        </label>
        <label>
          <span>Last name</span>
          <input
            autoComplete="family-name"
            name="lastName"
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Last name"
            value={lastName}
          />
        </label>
      </div>

      <div className="creator-apply-grid">
        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          <span>Phone number</span>
          <input
            autoComplete="tel"
            inputMode="tel"
            name="phone"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+1 310 555 0188"
            required
            type="tel"
            value={phone}
          />
        </label>
      </div>

      <div className="creator-apply-grid">
        <label>
          <span>Instagram handle</span>
          <input
            autoComplete="username"
            name="instagramHandle"
            onChange={(event) => setInstagramHandle(event.target.value)}
            placeholder="@yourinstagram"
            value={instagramHandle}
          />
        </label>
        <label>
          <span>TikTok handle</span>
          <input
            autoComplete="username"
            name="tiktokHandle"
            onChange={(event) => setTiktokHandle(event.target.value)}
            placeholder="@yourtiktok"
            value={tiktokHandle}
          />
        </label>
      </div>

      <label>
        <span>Expertise</span>
        <textarea
          name="profileDetails"
          onChange={(event) => setExpertise(event.target.value)}
          placeholder="Tell us what people already come to you for, what kind of advice you give, and what a useful 1:1 call with you would help them decide."
          rows={6}
          value={expertise}
        />
      </label>

      <button className="creator-apply-primary" type="submit">
        Submit application
      </button>
    </form>
  );
}

function ReviewState({
  creatorEmailDetail,
  creatorEmailStatus,
}: {
  creatorEmailDetail: string | null;
  creatorEmailStatus: string | null;
}) {
  return (
    <section className="creator-review-state" aria-labelledby="review-heading">
      <h1 id="review-heading">Application in review.</h1>
      <p>We will review your application and follow up soon.</p>
      <p>{getCreatorEmailStatusMessage(creatorEmailStatus, creatorEmailDetail)}</p>
    </section>
  );
}

function getCreatorEmailStatusMessage(
  status: string | null,
  detail: string | null,
) {
  if (status === "sent") {
    return "We sent a confirmation email to the address you provided.";
  }

  if (status === "skipped") {
    const reason = getCreatorEmailSkipReason(detail);
    return `Confirmation email not sent${reason ? `: ${reason}` : ""}.`;
  }

  return "If you included an email address, you will receive a confirmation email.";
}

function getCreatorEmailSkipReason(detail: string | null) {
  switch (detail) {
    case "missing-from":
      return "sender is not configured";
    case "missing-key":
      return "email provider is not configured";
    case "missing-recipient":
      return "email address is missing";
    case "request-failed":
      return "email provider request failed";
    default:
      return null;
  }
}
