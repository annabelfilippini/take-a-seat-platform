"use client";

import { useAuth, useClerk } from "@clerk/react";
import { useSignIn, useSignUp } from "@clerk/react/legacy";
import { useEffect, useRef, useState } from "react";
import {
  CREATOR_PROFILE_EDITOR_URL,
  getCreatorProfileEditorUrl,
} from "../_lib/creator-destination";

type SignInClerkScreenProps = {
  allowPhoneSignIn?: boolean;
  allowSignUpIfMissing?: boolean;
  className?: string;
  codeDescription?: string;
  codeHeading?: string;
  description?: string;
  eyebrow?: string;
  heading?: string;
  initialEmail?: string | null;
  initialPhone?: string | null;
  phoneLabel?: string;
  redirectUrl?: string;
  routeByAccount?: boolean;
  submitLabel?: string;
};

type AuthFlow = "sign-in" | "sign-up";
type AuthStep = "phone" | "code";
const codeSendCooldownMs = 30_000;

export function SignInClerkScreen({
  allowPhoneSignIn = false,
  allowSignUpIfMissing = false,
  className = "account-auth-widget",
  codeDescription,
  codeHeading,
  description,
  eyebrow,
  heading,
  initialEmail,
  initialPhone,
  phoneLabel = "Phone number",
  redirectUrl,
  routeByAccount = false,
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
  const { signOut } = useClerk();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [flow, setFlow] = useState<AuthFlow>("sign-in");
  const [phone, setPhone] = useState(() => formatInitialPhone(initialPhone));
  const [sentToPhone, setSentToPhone] = useState("");
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const [sendCooldownUntil, setSendCooldownUntil] = useState(0);
  const [step, setStep] = useState<AuthStep>("phone");
  const [submitting, setSubmitting] = useState(false);
  const [requestStalled, setRequestStalled] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const ready =
    isSignInLoaded &&
    isAuthLoaded &&
    (!allowSignUpIfMissing || isSignUpLoaded);
  const hasExplicitRedirect = Boolean(redirectUrl);
  const targetUrl = redirectUrl ?? "/take-a-seat";
  const cooldownRemainingSeconds = getCooldownRemainingSeconds(
    sendCooldownUntil,
    cooldownNow,
  );

  useEffect(() => {
    if (!submitting) return;
    const timeout = window.setTimeout(() => setRequestStalled(true), 20_000);
    return () => window.clearTimeout(timeout);
  }, [submitting]);

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

    if (!ready || !signIn || (allowSignUpIfMissing && !signUp)) {
      return;
    }

    if (isSignedIn) {
      setError("");
      setSendCooldownUntil(0);
      await redirectAfterAuth(targetUrl, hasExplicitRedirect, routeByAccount);
      return;
    }

    const { error: phoneError, phoneNumber } = method === "phone"
      ? normalizePhoneForClerk(phone)
      : { phoneNumber: email.trim().toLowerCase(), error: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : "Enter a valid email address." };

    if (!phoneNumber) {
      setError(method === "email" ? "Enter your email address." : "Enter your phone number.");
      return;
    }

    if (phoneError) {
      setError(phoneError);
      return;
    }

    if (cooldownRemainingSeconds > 0) {

      setError(
        `Please wait about ${cooldownRemainingSeconds} more seconds before requesting another code.`,
      );
      return;
    }

    setRequestStalled(false);
    setSubmitting(true);
    setError("");
    setSentToPhone(phoneNumber);

    try {
      const result = await signIn.create({
        identifier: phoneNumber,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setSignInActive({ session: result.createdSessionId });
        await redirectAfterAuth(targetUrl, hasExplicitRedirect, routeByAccount);
        return;
      }

      const factor = result.supportedFirstFactors?.find(
        (item) => item.strategy === (method === "email" ? "email_code" : "phone_code"),
      );

      if (factor?.strategy === "email_code" || factor?.strategy === "phone_code") {
        await result.prepareFirstFactor(factor.strategy === "email_code"
          ? { emailAddressId: factor.emailAddressId, strategy: "email_code" }
          : { phoneNumberId: factor.phoneNumberId, strategy: "phone_code" });
        setSendCooldownUntil(Date.now() + codeSendCooldownMs);
        setFlow("sign-in");
        setStep("code");
        return;
      }

      setError(getUnsupportedPhoneFactorMessage(allowSignUpIfMissing));
    } catch (err) {
      if (isIdentifierNotFoundError(err) && allowSignUpIfMissing && signUp) {
        try {
          await signUp.create(method === "email" ? { emailAddress: phoneNumber } : { phoneNumber });
          await signUp.prepareVerification({ strategy: method === "email" ? "email_code" : "phone_code" });
          setFlow("sign-up");
          setSendCooldownUntil(Date.now() + codeSendCooldownMs);
          setStep("code");
        } catch (signUpError) {
          setError(getClerkErrorMessage(signUpError));
        }
        return;
      }
      if (isTooManyCodeRequestsError(err)) {
        setSendCooldownUntil(Date.now() + codeSendCooldownMs);
        setError("We could not send a new code yet. Wait 30 seconds and try again.");
        return;
      }

      setSendCooldownUntil(0);

      if (isSessionExistsError(err)) {
        setStep("phone");
        setError("");
        await redirectAfterAuth(targetUrl, hasExplicitRedirect, routeByAccount);
        return;
      }

      setError(getClerkStartErrorMessage(err, allowSignUpIfMissing));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyPhoneCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ready || !signIn || (flow === "sign-up" && !signUp)) {
      return;
    }

    const verificationCode = code.trim();

    if (!verificationCode) {
      setError("Enter the verification code.");
      return;
    }

    setRequestStalled(false);
    setSubmitting(true);
    setError("");

    try {
      if (flow === "sign-up") {
        if (!signUp || !setSignUpActive) return;
        const result = await signUp.attemptVerification({
          code: verificationCode,
          strategy: method === "email" ? "email_code" : "phone_code",
        });

        if (result.status === "complete" && result.createdSessionId) {
          await setSignUpActive({ session: result.createdSessionId });
          await redirectAfterAuth(targetUrl, hasExplicitRedirect, routeByAccount);
          return;
        }
      } else {
        try {
          const result = await signIn.attemptFirstFactor({
            code: verificationCode,
            strategy: method === "email" ? "email_code" : "phone_code",
          });

          if (result.status === "complete" && result.createdSessionId) {
            await setSignInActive({ session: result.createdSessionId });
            await redirectAfterAuth(targetUrl, hasExplicitRedirect, routeByAccount);
            return;
          }
        } catch (err) {
          if (!isSignUpTransferError(err)) {
            throw err;
          }

          if (!allowSignUpIfMissing || !signUp) {
            throw err;
          }

          const result = await signUp.create({ transfer: true });

          if (result.status === "complete" && result.createdSessionId) {
            await setSignUpActive({ session: result.createdSessionId });
            await redirectAfterAuth(targetUrl, hasExplicitRedirect, routeByAccount);
            return;
          }

          setFlow("sign-up");
        }
      }

      setError("Verification needs an additional account step. Please contact Take a Seat so we can help you finish signing in.");
    } catch (err) {
      setError(getClerkVerificationErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    if (submitting || cooldownRemainingSeconds > 0) return;
    setRequestStalled(false);
    setSubmitting(true);
    setError("");
    try {
      const strategy = method === "email" ? "email_code" : "phone_code";
      if (flow === "sign-up") {
        await signUp?.prepareVerification({ strategy });
      } else {
        const factor = signIn?.supportedFirstFactors?.find((item) => item.strategy === strategy);
        if (factor?.strategy === "email_code") await signIn?.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
        else if (factor?.strategy === "phone_code") await signIn?.prepareFirstFactor({ strategy: "phone_code", phoneNumberId: factor.phoneNumberId });
        else throw new Error("Request a new code from the sign-in screen.");
      }
      setCode("");
      setSendCooldownUntil(Date.now() + codeSendCooldownMs);
    } catch {
      setError("We could not resend your code. Wait a moment and try again.");
    } finally { setSubmitting(false); }
  }

  function editPhone() {
    setCode("");
    setError("");
    setSentToPhone("");
    setStep("phone");
  }

  return (
    <div className={className}>
      <div id="clerk-captcha" />
      {requestStalled && submitting ? <p className="phone-auth-error" role="alert">The verification service is taking too long. Complete any browser security check, or <a href={typeof window === "undefined" ? "/sign-in" : window.location.href}>reload and try again</a>.</p> : null}
      {isSignedIn ? <div className="phone-auth-heading">
        <p>You are already signed in. Continue to your profile, or use a different account.</p>
        <a className="phone-auth-submit" href={targetUrl}>Continue to my profile</a>
        <button className="phone-auth-text-button" type="button" onClick={() => signOut({ redirectUrl: window.location.href })}>Use a different account</button>
      </div> : step === "code" ? (
        <form className="phone-auth-form" onSubmit={verifyPhoneCode}>
          <div className="phone-auth-heading">
            {eyebrow ? <span>{eyebrow}</span> : null}
            <h2>{codeHeading ?? "Enter your verification code."}</h2>
            <p>
              {codeDescription ?? (method === "email" ? "Enter the code we emailed you." : "Enter the code we texted you.")}
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
          {error ? <p className="phone-auth-error" role="alert">{error}</p> : null}
          <button className="phone-auth-submit" disabled={submitting} type="submit">
            {submitting ? "Checking code" : "Verify code"}
          </button>
          <button className="phone-auth-text-button" disabled={submitting || cooldownRemainingSeconds > 0} onClick={resendCode} type="button">
            {cooldownRemainingSeconds > 0 ? `Resend in ${cooldownRemainingSeconds}s` : "Resend code"}
          </button>
          <button className="phone-auth-text-button" disabled={submitting} onClick={editPhone} type="button">
            Use a different email or phone number
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
            <span>{method === "email" ? "Email address" : phoneLabel}</span>
            <input
              autoComplete={method === "email" ? "email" : "tel"}
              inputMode={method === "email" ? "email" : "tel"}
              name={method}
              onChange={(event) => method === "email" ? setEmail(event.target.value) : setPhone(event.target.value)}
              placeholder={method === "email" ? "you@example.com" : "+1 555 000 0000"}
              required
              type={method === "email" ? "email" : "tel"}
              value={method === "email" ? email : phone}
            />
          </label>
          {allowPhoneSignIn ? <button className="phone-auth-text-button" type="button" disabled={submitting} onClick={() => { setMethod(method === "email" ? "phone" : "email"); setError(""); }}>
            {method === "email" ? "Use a phone number instead" : "Use an email address instead"}
          </button> : null}
          {error ? <p className="phone-auth-error" role="alert">{error}</p> : null}
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

async function redirectAfterAuth(
  fallbackUrl: string,
  hasExplicitRedirect: boolean,
  routeByAccount: boolean,
) {
  try {
    window.location.assign(
      await getPostAuthRedirectUrl(fallbackUrl, hasExplicitRedirect, routeByAccount),
    );
  } catch {
    window.location.assign(fallbackUrl);
  }
}

async function getPostAuthRedirectUrl(
  fallbackUrl: string,
  hasExplicitRedirect: boolean,
  routeByAccount: boolean,
) {
  if (hasExplicitRedirect && !routeByAccount) {
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

  return "We could not send a verification code. Check your email address or phone number and try again.";
}

function getClerkStartErrorMessage(
  error: unknown,
  allowSignUpIfMissing: boolean,
) {
  if (!allowSignUpIfMissing && isIdentifierNotFoundError(error)) {
    return "We could not find an invited creator account for that phone number.";
  }

  return getClerkErrorMessage(error);
}

function getUnsupportedPhoneFactorMessage(allowSignUpIfMissing: boolean) {
  return allowSignUpIfMissing
    ? "We could not start phone verification for that number. Confirm phone sign-in and sign-up are enabled in Clerk, then try again."
    : "We could not find an invited creator account for that phone number.";
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

function isIdentifierNotFoundError(error: unknown) {
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

    return (
      code === "form_identifier_not_found" ||
      code === "identifier_not_found" ||
      message.includes("couldn't find your account") ||
      message.includes("could not find your account")
    );
  });
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
    return code === "sign_up_if_missing_transfer";
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
