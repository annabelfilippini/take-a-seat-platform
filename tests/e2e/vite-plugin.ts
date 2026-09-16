import { resolve } from 'node:path';
export function e2ePlugin() {
  return { name:'take-a-seat-isolated-e2e', enforce:'pre' as const,
    resolveId(source: string) {
      if (source.endsWith('/clerk-auth')) return resolve('tests/e2e/auth.ts');
    },
    transform(code: string, id: string) {
      if (id.includes('/app/_components/CreatorEmailSignIn.tsx')) {
        return code.replaceAll('"@clerk/react"', JSON.stringify(resolve('tests/e2e/clerk-email-client.ts')))
          .replaceAll('"@clerk/react/legacy"', JSON.stringify(resolve('tests/e2e/clerk-email-client.ts')));
      }
      if (id.includes('/app/creators/email-sign-in/page.tsx')) {
        return code.replace('getClerkPublishableKey() ?', 'true ?');
      }
      if (/app\/(?:_lib\/(?:email|checkout-holds|stripe-payments|stripe-connect|creator-payments|booking-decisions|google-calendar)|api\/(?:google-calendar\/oauth\/callback|bookings\/(?:request|approve)|stripe\/(?:checkout\/complete|webhook)))\b/.test(id) && !id.includes('node_modules')) {
        return `import { fixtureFetch as fetch } from "${resolve('tests/e2e/providers.ts')}";\n${code}`;
      }
    },
  };
}
