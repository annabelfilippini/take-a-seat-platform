"use client";

import { Show, SignInButton, UserButton } from "@clerk/react";
import { CREATOR_PROFILE_EDITOR_URL } from "../creator-destination";

export function CreatorAuthControls() {
  return (
    <div className="creator-auth-controls">
      <Show when="signed-out">
        <SignInButton fallbackRedirectUrl={CREATOR_PROFILE_EDITOR_URL} mode="modal">
          <button className="creator-auth-button" type="button">
            Creator sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <a className="creator-auth-link" href={CREATOR_PROFILE_EDITOR_URL}>
          Dashboard
        </a>
        <UserButton />
      </Show>
    </div>
  );
}
