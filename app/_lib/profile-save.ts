// Leave room for both the published profile and private draft in one D1 row.
export const MAX_PROFILE_BYTES = 800_000;
export const PROFILE_MEDIA_BUDGET = 650_000;

export class ProfileConflictError extends Error {
  constructor() {
    super("This draft changed in another tab. Copy your unsaved edits, reload to see the latest saved draft, then reapply your changes.");
  }
}

export function profileByteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export class ProfileSizeError extends Error {
  constructor() {
    super("Your profile is too large to save. Try a smaller video or fewer photos. Your edits are still here.");
  }
}

export function profileSaveError(detail?: string, status?: number) {
  if (detail === "draft-conflict") return new ProfileConflictError().message;
  if (status === 413 || detail === "profile-too-large") return new ProfileSizeError().message;
  if (detail === "creator-access" || detail === "creator-auth" || status === 401 || status === 403) {
    return "Your sign-in could not be verified. Keep this tab open, sign in again in another tab, then retry Save draft.";
  }
  if (detail === "profile-required") return "Your profile needs a valid application email before it can be saved.";
  if (detail && /[ .]/.test(detail) && detail.length < 400) return detail;
  return "We couldn't save your profile. Your edits are still here. Please retry Save draft.";
}
