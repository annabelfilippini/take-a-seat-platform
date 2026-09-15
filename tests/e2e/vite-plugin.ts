import { resolve } from 'node:path';
export function e2ePlugin() {
  return { name:'take-a-seat-isolated-e2e', enforce:'pre' as const,
    resolveId(source: string) {
      if (source.endsWith('/clerk-auth')) return resolve('tests/e2e/auth.ts');
    },
    transform(code: string, id: string) {
      if (/app\/(?:_lib\/(?:email|checkout-holds|stripe-connect|creator-payments|booking-decisions|google-calendar)|api\/(?:bookings\/(?:request|approve)|stripe\/(?:checkout\/complete|webhook)))\b/.test(id) && !id.includes('node_modules')) {
        return `import { fixtureFetch as fetch } from "${resolve('tests/e2e/providers.ts')}";\n${code}`;
      }
    },
  };
}
