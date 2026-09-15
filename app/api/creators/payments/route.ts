import { getCreatorIntegrationAccess } from '../../../_lib/creator-access';
import { getCreatorPaymentView, stripeAccountRequest } from '../../../_lib/creator-payments';
import { getCreatorStripeConnection } from '../../../_lib/stripe-connect';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('creatorId') ?? '';
  if ((await getCreatorIntegrationAccess(request, id)).status !== 'allowed') return Response.json({ error: 'Sign in to view payments.' }, { status: 403 });
  try { return Response.json(await getCreatorPaymentView(id), { headers: { 'cache-control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Unable to check Stripe. Retry.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  const form = await request.formData();
  const id = String(form.get('creatorId') ?? '');
  if ((await getCreatorIntegrationAccess(request, id)).status !== 'allowed') return Response.json({ error: 'Sign in to open Stripe.' }, { status: 403 });
  try {
    const connection = await getCreatorStripeConnection(id);
    if (!connection) return Response.json({ error: 'Connect Stripe first.' }, { status: 400 });
    const link = await stripeAccountRequest<{url:string}>(`accounts/${encodeURIComponent(connection.stripeAccountId)}/login_links`, connection.stripeAccountId, 'POST');
    return Response.json({ url: link.url });
  } catch { return Response.json({ error: 'Stripe could not open. Please retry.' }, { status: 503 }); }
}
