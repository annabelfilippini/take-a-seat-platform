// Copied ONLY into the isolated E2E app. Never included in app/ for production.
import { env } from 'cloudflare:workers';
import { getCreatorApplication, createCreatorInvite } from '../../app/_lib/creator-onboarding';
import { markBookingPaymentAuthorized } from '../../app/_lib/bookings';
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has('login')) return new Response(null,{status:303,headers:{location:url.searchParams.get('returnTo') || '/creator/profile','set-cookie':'tas_e2e_creator=1; HttpOnly; Path=/; SameSite=Lax'}});
  if (url.searchParams.has('logout')) return new Response(null,{status:303,headers:{location:'/creator/profile','set-cookie':'tas_e2e_creator=; Max-Age=0; Path=/'}});
  if (url.searchParams.has('checkout')) {
    const id = url.searchParams.get('checkout')!;
    await markBookingPaymentAuthorized({bookingId:id,stripeCheckoutSessionId:`cs_${id}`,stripePaymentIntentId:`pi_${id}`});
    return new Response('<!doctype html><link rel="icon" href="/favicon.png"><p>Payment authorized in the isolated Stripe fixture.</p>', {headers:{'content-type':'text/html'}});
  }
  const events = await env.DB.prepare('SELECT * FROM e2e_provider_events').all();
  return Response.json(events.results);
}
export async function POST(request: Request) {
  const body = await request.json() as {sql?:string;args?:unknown[];creatorId?:string;invite?:boolean};
  if (body.sql) return Response.json(await env.DB.prepare(body.sql).bind(...(body.args || [])).all());
  if(body.invite && body.creatorId) return Response.json(await createCreatorInvite((await getCreatorApplication(body.creatorId))!));
  return Response.json({ok:true});
}
