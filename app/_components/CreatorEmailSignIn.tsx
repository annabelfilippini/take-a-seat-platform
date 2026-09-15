"use client";

import { useClerk, useUser } from "@clerk/react";
import { useSignIn } from "@clerk/react/legacy";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export function CreatorEmailSignIn() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: userLoaded, user } = useUser();
  const { signOut } = useClerk();
  const started = useRef(false);
  const [error, setError] = useState("");
  const href = useSyncExternalStore(subscribeToLocation, () => window.location.href, () => "");
  const url = new URL(href || "https://takeaseatwith.com/creators/email-sign-in");
  const fragment = new URLSearchParams(url.hash.slice(1));
  const ticket = fragment.get("ticket");
  const email = fragment.get("email")?.trim().toLowerCase();
  const invite = url.searchParams.get("invite");
  const destination = invite ? `/creator/profile?${new URLSearchParams({ invite })}` : "/creator/profile";
  const switchAccount = Boolean(user && ticket && (!email || user.primaryEmailAddress?.emailAddress.toLowerCase() !== email));

  useEffect(() => {
    if (!href || !isLoaded || !userLoaded || !signIn || started.current || switchAccount) return;
    started.current = true;
    const target = destination;
    if (user) {
      window.location.replace(target);
      return;
    }
    // Fragments never reach Worker logs or referrers. Remove this credential
    // from the address bar/history before contacting Clerk.
    window.history.replaceState(null, "", new URL(href).pathname + new URL(href).search);
    if (!ticket) {
      window.location.replace(target);
      return;
    }
    const timeout = window.setTimeout(() => setError("Sign-in is taking longer than expected. You can continue with an email code below."), 20_000);
    void (async () => {
      try {
        const result = await signIn.create({ strategy: "ticket", ticket });
        if (result.status !== "complete" || !result.createdSessionId) throw new Error("Additional verification required");
        await setActive({ session: result.createdSessionId });
        window.location.replace(target);
      } catch {
        setError("This sign-in link has expired, has already been used, or needs another verification step. Continue with your application email to open your profile.");
      } finally {
        window.clearTimeout(timeout);
      }
    })();
  }, [href, isLoaded, userLoaded, signIn, setActive, user, switchAccount, destination, ticket]);

  if (switchAccount) return <div className="phone-auth-heading">
    <p>You’re signed in with a different account. Switch to the creator account in your acceptance email to continue.</p>
    <button className="phone-auth-submit" type="button" onClick={() => {
      void signOut({ redirectUrl: window.location.href }).catch(() => setError("We could not switch accounts. Please try again."));
    }}>Switch to my creator account</button>
    {error ? <p role="alert">{error}</p> : null}
  </div>;
  return <div className="phone-auth-heading">
    <p role={error ? "alert" : "status"}>{error || "Signing you in and opening your private creator profile…"}</p>
    <a className="admin-back-link" href={destination}>Continue with an email code</a>
  </div>;
}

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}
