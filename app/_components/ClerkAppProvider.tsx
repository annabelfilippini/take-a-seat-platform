"use client";

import { ClerkProvider } from "@clerk/react";
import type { ReactNode } from "react";

type ClerkAppProviderProps = {
  children: ReactNode;
  publishableKey: string | null;
};

export function ClerkAppProvider({
  children,
  publishableKey,
}: ClerkAppProviderProps) {
  if (!publishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/creators/dashboard"
      signUpFallbackRedirectUrl="/creators/dashboard"
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
