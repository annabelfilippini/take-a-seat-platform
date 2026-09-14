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
  const [socialHandle, setSocialHandle] = useState("");
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
        <ReviewState />
      ) : (
        <div className="creator-application-layout">
          <ApplicationForm
            email={email}
            expertise={expertise}
            firstName={firstName}
            lastName={lastName}
            name={name}
            phone={phone}
            setSocialHandle={setSocialHandle}
            setEmail={setEmail}
            setExpertise={setExpertise}
            setFirstName={setFirstName}
            setLastName={setLastName}
            setPhone={setPhone}
            socialHandle={socialHandle}
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
  lastName,
  name,
  phone,
  setSocialHandle,
  setEmail,
  setExpertise,
  setFirstName,
  setLastName,
  setPhone,
  socialHandle,
}: {
  email: string;
  expertise: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  setSocialHandle: (value: string) => void;
  setEmail: (value: string) => void;
  setExpertise: (value: string) => void;
  setFirstName: (value: string) => void;
  setLastName: (value: string) => void;
  setPhone: (value: string) => void;
  socialHandle: string;
}) {
  return (
    <form
      action="/api/creators/profile"
      className="creator-application-form"
      method="post"
    >
      <h1>Apply to Inspire</h1>
      <input name="category" type="hidden" value="Style & Beauty" />
      <input name="currency" type="hidden" value="USD" />
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

      <label>
        <span>Social handle</span>
        <input
          autoComplete="username"
          name="instagramHandle"
          onChange={(event) => setSocialHandle(event.target.value)}
          placeholder="@yourhandle or website"
          value={socialHandle}
        />
      </label>

      <label>
        <span>Expertise</span>
        <textarea
          name="profileDetails"
          onChange={(event) => setExpertise(event.target.value)}
          placeholder="What will you talk about in a 1:1 call?"
          rows={2}
          value={expertise}
        />
      </label>

      <button className="creator-apply-primary" type="submit">
        Submit application
      </button>
    </form>
  );
}

function ReviewState() {
  return (
    <section className="creator-review-state" aria-labelledby="review-heading">
      <h1 id="review-heading">Your application is in review.</h1>
      <p>We will email you with an update.</p>
    </section>
  );
}
