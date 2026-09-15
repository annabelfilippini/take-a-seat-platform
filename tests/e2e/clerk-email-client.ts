// Isolated browser fixture for Clerk's same-document sign-out transition.
// Only CreatorEmailSignIn imports this file, via the test server's Vite plugin.
import { useState } from 'react';
const wrongUser = { primaryEmailAddress: { emailAddress: 'admin@example.com' } };
export function useUser() {
  return { isLoaded: true, user: typeof document !== 'undefined' && !document.cookie.includes('tas_email_signed_out=1') ? wrongUser : null };
}
export function useSignIn() {
  const [freshSignedOutClient] = useState(() => typeof document !== 'undefined' && document.cookie.includes('tas_email_signed_out=1'));
  return { isLoaded: true, signIn: freshSignedOutClient ? {
    async create({ ticket }: { ticket: string }) {
      if (ticket !== 'e2e-email-ticket') throw new Error('Invalid test ticket');
      sessionStorage.setItem('tas_email_ticket_uses', String(Number(sessionStorage.getItem('tas_email_ticket_uses') || '0') + 1));
      return { status: 'complete', createdSessionId: 'session_e2e' };
    },
  } : undefined, async setActive() { document.cookie = 'tas_e2e_creator=1; path=/'; } };
}
export function useClerk() {
  const [, rerender] = useState(0);
  return { async signOut(callback?: (() => void) | { redirectUrl?: string }) {
    document.cookie = 'tas_email_signed_out=1; path=/';
    rerender(value => value + 1);
    // Clerk may leave a same-URL redirect on the current document. Its callback
    // is the supported escape hatch for an explicit full-page transition.
    if (typeof callback === 'function') callback();
  } };
}
