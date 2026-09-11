"use client";

import { useAuth } from "@clerk/react";
import { useSignIn, useSignUp } from "@clerk/react/legacy";
import { useEffect, useRef, useState } from "react";
import {
  CREATOR_PROFILE_EDITOR_URL,
  getCreatorProfileEditorUrl,
} from "../_lib/creator-destination";

type SignInClerkScreenProps = {
  className?: string;
  codeDescription?: string;
  codeHeading?: string;
  description?: string;
  eyebrow?: string;
  heading?: string;
  initialPhone?: string | null;
  phoneLabel?: string;
  redirectUrl?: string;
  submitLabel?: string;
};

type AuthFlow = "sign-in" | "sign-up";
type AuthStep = "phone" | "code";
const codeSendCooldownMs = 30_000;

export function SignInClerkScreen({
  className = "account-auth-widget",
  codeDescription,
  codeHeading,
  description,
  eyebrow,
  heading,
  initialPhone,
  phoneLabel = "Phone number",
  redirectUrl,
  submitLabel = "Send code",
}: SignInClerkScreenProps) {
  const {
    isLoaded: isSignInLoaded,
    setActive: setSignInActive,
    signIn,
  } = useSignIn();
  const {
    isLoaded: isSignUpLoaded,
    setActive: setSignUpActive,
    signUp,
  } = useSignUp();
  const {
    isLoaded: isAuthLoaded,
    isSignedIn,
  } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [flow, setFlow] = useState<AuthFlow>("sign-in");
  const [phone, setPhone] = useState(() => formatInitialPhone(initialPhone));
  const [sentToPhone, setSentToPhone] = useState("");
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const [sendCooldownUntil, setSendCooldownUntil] = useState(0);
  const [step, setStep] = useState<AuthStep>("phone");
  const [submitting, setSubmitting] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const ready = isSignInLoaded && isSignUpLoaded && isAuthLoaded;
  const hasExplicitRedirect = Boolean(redirectUrl);
  const targetUrl = redirectUrl ?? "/take-a-seat";
  const cooldownRemainingSeconds = getCooldownRemainingSeconds(
    sendCooldownUntil,
    cooldownNow,
  );

  useEffect(() => {
    if (step === "code") {
      codeInputRef.current?.focus({ preventScroll: true });
    }
  }, [step]);

  useEffect(() => {
    if (!sendCooldownUntil || Date.now() >= sendCooldownUntil) {
      return;
    }

    const tick = window.setInterval(() => {
      const nextNow = Date.now();

      setCooldownNow(nextNow);

      if (nextNow >= sendCooldownUntil) {
        setSendCooldownUntil(0);
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, [sendCooldownUntil]);

  async function startPhoneCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ready || !signIn || !signUp) {
      return;
    }

    if (isSignedIn) {
      setError("");
      setSendCooldownUntil(0);
      await redirectAfterAuth(targetUrl, hasExplicitRedirect);
      return;
    }

    const { error: phoneError, phoneNumber } = normalizePhoneForClerk(phone);

    if (!phoneNumber) {
      setError("Enter your phone number.");
      return;
    }

    if (phoneError) {
      setError(phoneError);
      return;
    }

    if (cooldownRemainingSeconds > 0) {
      setSentToPhone(phoneNumber);
      setStep("code");
      setError(
        `Clerk is pausing new code sends for about ${cooldownRemainingSeconds} more seconds. If a code already arrived, enter the latest one here.`,
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setSentToPhone(phoneNumber);
    setSendCooldownUntil(Date.now() + codeSendCooldownMs);

    try {
      const result = await signIn.create({
        identifier: phoneNumber,
        signUpIfMissing: true,
        strategy: "phone_code",
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setSignInActive({ session: result.createdSessionId });
        await redirectAfterAuth(targetUrl, hasExplicitRedirect);
        return;
      }

      const phoneFactor = result.supportedFirstFactors?.find(
        (factor) => factor.strategy === "phone_code",
      );

      if (phoneFactor?.strategy === "phone_code") {
        await result.prepareFirstFactor({
          phoneNumberId: phoneFactor.phoneNumberId,
          strategy: "phone_code",
        });
        setFlow("sign-in");
        setStep("code");
        return;
      }

      await signUp.create({
        phoneNumber,
      });
      await signUp.prepareVerification({ strategy: "phone_code" });
      setFlow("sign-up");
      setStep("code");
    } catch (err) {
      if (isTooManyCodeRequestsError(err)) {
        setStep("code");
        setError(
          "Clerk is pausing new code sends. If a code already arrived, enter the latest one here. Otherwise wait about 30 seconds, then try again.",
        );
        return;
      }

      setSendCooldownUntil(0);

      if (isSessionExistsError(err)) {
        setStep("phone");
        setError("");
        await redirectAfterAuth(targetUrl, hasExplicitRedirect);
        return;
      }

      setError(getClerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyPhoneCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ready || !signIn || !signUp) {
      return;
    }

    const verificationCode = code.trim();

    if (!verificationCode) {
      setError("Enter the verification code.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (flow === "sign-up") {
        const result = await signUp.attemptVerification({
          code: verificationCode,
          strategy: "phone_code",
        });

        if (result.status === "complete" && result.createdSessionId) {
          await setSignUpActive({ session: result.createdSessionId });
          await redirectAfterAuth(targetUrl, hasExplicitRedirect);
          return;
        }
      } else {
        try {
          const result = await signIn.attemptFirstFactor({
            code: verificationCode,
            strategy: "phone_code",
          });

          if (result.status === "complete" && result.createdSessionId) {
            await setSignInActive({ session: result.createdSessionId });
            await redirectAfterAuth(targetUrl, hasExplicitRedirect);
            return;
          }
        } catch (err) {
          if (!isSignUpTransferError(err)) {
            throw err;
          }

          const result = await signUp.create({ transfer: true });

          if (result.status === "complete" && result.createdSessionId) {
            await setSignUpActive({ session: result.createdSessionId });
            await redirectAfterAuth(targetUrl, hasExplicitRedirect);
            return;
          }

          setFlow("sign-up");
        }
      }

      setError("That code was not accepted. Try the newest code you received.");
    } catch (err) {
      setError(getClerkVerificationErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function editPhone() {
    setCode("");
    setError("");
    setSentToPhone("");
    setStep("phone");
  }

  return (
    <div className={className}>
      {step === "code" ? (
        <form className="phone-auth-form" onSubmit={verifyPhoneCode}>
          <div className="phone-auth-heading">
            {eyebrow ? <span>{eyebrow}</span> : null}
            <h2>{codeHeading ?? "Enter your verification code."}</h2>
            <p>
              {codeDescription ?? "Enter the code we just texted you."}
              {sentToPhone ? (
                <>
                  {" "}
                  Sent to <strong>{sentToPhone}</strong>.
                </>
              ) : null}
            </p>
          </div>
          <label>
            <span>Verification code</span>
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={8}
              name="code"
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              ref={codeInputRef}
              required
              type="text"
              value={code}
            />
          </label>
          {error ? <p className="phone-auth-error">{error}</p> : null}
          <button className="phone-auth-submit" disabled={submitting} type="submit">
            {submitting ? "Checking code" : "Verify code"}
          </button>
          <button className="phone-auth-text-button" onClick={editPhone} type="button">
            Use a different phone number
          </button>
        </form>
      ) : (
        <form className="phone-auth-form" noValidate onSubmit={startPhoneCode}>
          {heading || description ? (
            <div className="phone-auth-heading">
              {eyebrow ? <span>{eyebrow}</span> : null}
              {heading ? <h2>{heading}</h2> : null}
              {description ? <p>{description}</p> : null}
            </div>
          ) : null}
          <label>
            <span>{phoneLabel}</span>
            <input
              autoComplete="tel"
              inputMode="tel"
              name="phone"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+1 555 000 0000"
              required
              type="tel"
              value={phone}
            />
          </label>
          <div id="clerk-captcha" />
          {error ? <p className="phone-auth-error">{error}</p> : null}
          <button
            className="phone-auth-submit"
            disabled={!ready || submitting || cooldownRemainingSeconds > 0}
            type="submit"
          >
            {submitting
              ? "Sending code"
              : cooldownRemainingSeconds > 0
                ? `Try again in ${cooldownRemainingSeconds}s`
                : submitLabel}
          </button>
        </form>
      )}
    </div>
  );
}

async function redirectAfterAuth(fallbackUrl: string, hasExplicitRedirect: boolean) {
  try {
    window.location.assign(
      await getPostAuthRedirectUrl(fallbackUrl, hasExplicitRedirect),
    );
  } catch {
    window.location.assign(fallbackUrl);
  }
}

async function getPostAuthRedirectUrl(
  fallbackUrl: string,
  hasExplicitRedirect: boolean,
) {
  if (hasExplicitRedirect) {
    return fallbackUrl;
  }

  const response = await fetch("/api/creators/account", {
    credentials: "same-origin",
  });

  if (!response.ok) {
    return fallbackUrl;
  }

  const account = (await response.json()) as {
    profile?: { id?: unknown };
    status?: unknown;
  };

  if (account.status === "linked" || account.status === "matched") {
    return typeof account.profile?.id === "string"
      ? getCreatorProfileEditorUrl(account.profile.id)
      : CREATOR_PROFILE_EDITOR_URL;
  }

  return fallbackUrl;
}

function formatInitialPhone(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  return normalizePhoneForClerk(trimmed).phoneNumber ?? trimmed;
}

function normalizePhoneForClerk(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  const digits = trimmed.replace(/\D/g, "");

  if (!digits) {
    return { phoneNumber: "" };
  }

  if (trimmed.startsWith("+")) {
    return digits.length >= 8
      ? { phoneNumber: `+${digits}` }
      : {
          error:
            "Enter a valid phone number. Outside the US or Canada, include the country code.",
          phoneNumber: "",
        };
  }

  if (digits.length === 10) {
    return { phoneNumber: `+1${digits}` };
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return { phoneNumber: `+${digits}` };
  }

  return {
    error:
      "Enter a valid phone number with area code. Outside the US or Canada, include the country code.",
    phoneNumber: "",
  };
}

function getClerkErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error &&
    "errors" in error &&
    Array.isArray(error.errors)
  ) {
    const first = error.errors[0] as { message?: unknown } | undefined;

    if (typeof first?.message === "string" && first.message.trim()) {
      return first.message;
    }
  }

  return "We could not send a code for that phone number. Check it and try again.";
}

function getClerkVerificationErrorMessage(error: unknown) {
  const clerkMessage = getClerkErrorMessage(error);

  if (isTooManyCodeRequestsError(error)) {
    return "Too many attempts for the moment. Wait about 30 seconds, then try the newest code again.";
  }

  if (clerkMessage.toLowerCase().includes("verification code before attempting")) {
    return "This code screen lost the original request. Wait about 30 seconds, then go back and request a new code.";
  }

  return clerkMessage;
}

function getCooldownRemainingSeconds(cooldownUntil: number, now: number) {
  if (!cooldownUntil) {
    return 0;
  }

  return Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
}

function isTooManyCodeRequestsError(error: unknown) {
  if (
    typeof error !== "object" ||
    !error ||
    !("errors" in error) ||
    !Array.isArray(error.errors)
  ) {
    return false;
  }

  return error.errors.some((item) => {
    const clerkError = item as { code?: unknown; longMessage?: unknown; message?: unknown };
    const code = typeof clerkError.code === "string" ? clerkError.code : "";
    const message =
      typeof clerkError.message === "string" ? clerkError.message.toLowerCase() : "";
    const longMessage =
      typeof clerkError.longMessage === "string"
        ? clerkError.longMessage.toLowerCase()
        : "";

    return (
      code === "too_many_requests" ||
      code === "verification_code_too_many_requests" ||
      message.includes("too many") ||
      longMessage.includes("too many")
    );
  });
}

function isSignUpTransferError(error: unknown) {
  if (
    typeof error !== "object" ||
    !error ||
    !("errors" in error) ||
    !Array.isArray(error.errors)
  ) {
    return false;
  }

  return error.errors.some((item) => {
    const clerkError = item as { code?: unknown; message?: unknown };
    const code = typeof clerkError.code === "string" ? clerkError.code : "";
    const message =
      typeof clerkError.message === "string" ? clerkError.message.toLowerCase() : "";

    return code === "sign_up_if_missing_transfer" || message.includes("transfer");
  });
}

function isSessionExistsError(error: unknown) {
  if (
    typeof error !== "object" ||
    !error ||
    !("errors" in error) ||
    !Array.isArray(error.errors)
  ) {
    return false;
  }

  return error.errors.some((item) => {
    const clerkError = item as { code?: unknown; message?: unknown };
    const code = typeof clerkError.code === "string" ? clerkError.code : "";
    const message =
      typeof clerkError.message === "string" ? clerkError.message.toLowerCase() : "";

    return code === "session_exists" || message.includes("session already exists");
  });
}
