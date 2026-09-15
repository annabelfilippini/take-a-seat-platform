import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import { encryptToken } from '../../app/_lib/token-encryption';
const creatorId='onboard_e2e';
async function sql(request:APIRequestContext, statement:string, args:unknown[] = []) {
  const response=await request.post('/e2e-control',{data:{sql:statement,args}});
  expect(response.ok(),await response.text()).toBeTruthy();
  return (await response.json()).results;
}
async function reset(request:APIRequestContext) {
  await sql(request,'CREATE TABLE IF NOT EXISTS e2e_state (id TEXT PRIMARY KEY, value TEXT)');
  const exists=await sql(request,"SELECT name FROM sqlite_master WHERE name='customer_bookings'");
  if(!exists.length) for(const file of readdirSync(resolve('drizzle')).filter((name)=>name.endsWith('.sql')).sort()) {
    for(const statement of readFileSync(resolve('drizzle',file),'utf8').split('--> statement-breakpoint').flatMap((part)=>part.split(';')).filter((part)=>part.trim())) await sql(request,statement);
  }
  await sql(request,'CREATE TABLE IF NOT EXISTS e2e_provider_events (id TEXT PRIMARY KEY, kind TEXT, payload TEXT)');
  for(const table of ['creator_media_chunks','creator_media','customer_bookings','creator_notifications','creator_notification_preferences','creator_accounts','creator_invites','creator_availability_rules','creator_stripe_connections','creator_calendar_connections','creator_onboarding_profiles','e2e_provider_events','e2e_state']) await sql(request,`DELETE FROM ${table}`);
  await sql(request,"INSERT INTO e2e_state VALUES ('stripe','active')");
  await sql(request,"INSERT INTO creator_onboarding_profiles (id,name,email,instagram_platform,bio,application_status,public_slug) VALUES (?, 'Original Creator','creator@example.com','style','', 'accepted','e2e-creator')",[creatorId]);
  await sql(request,"INSERT INTO creator_accounts (creator_id,clerk_user_id,email) VALUES (?, 'user_e2e','creator@example.com')",[creatorId]);
  await sql(request,"INSERT INTO creator_stripe_connections (creator_id,stripe_account_id,account_country) VALUES (?, 'acct_e2e','US')",[creatorId]);
  await sql(request,"UPDATE creator_onboarding_profiles SET calendar_connected_at='2026-09-14',stripe_connected_at='2026-09-14' WHERE id=?",[creatorId]);
  const encrypted=await encryptToken('e2e_access','e2e_fixture');
  await sql(request,"INSERT INTO creator_calendar_connections (creator_id,scopes,access_token_encrypted,expires_at) VALUES (?, ?, ?, ?)",[creatorId,'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy',encrypted,Date.now()+86400000]);
  // Useful default hours in every day avoid dependence on the test-run date.
  for(let day=0;day<7;day++) await sql(request,"INSERT INTO creator_availability_rules (creator_id,timezone,day_of_week,start_time,end_time,min_notice_minutes,buffer_minutes) VALUES (?,'America/Los_Angeles',?,'09:00','12:00',0,0)",[creatorId,day]);
}
async function login(page:Page, destination='/creator/profile') { await page.goto(`/e2e-control?login=1&returnTo=${encodeURIComponent(destination)}`); await expect(page.getByRole('tab',{name:'Profile',exact:true})).toBeVisible(); }
async function save(page:Page) { await page.getByRole('button',{name:'Save draft',exact:true}).last().click(); await expect(page.locator('.creator-storefront-bar')).toContainText('Saved at'); }
async function seedDraft(request:APIRequestContext) {
  const draft={name:'Published Creator',about:'Thoughtful styling advice.',bio:'Styling advice',category:'Style & Beauty',currency:'USD',helpItems:'Trip packing\nWork outfits',instagramHandle:'stylist',tiktokHandle:'',location:'',offer:'',oneToOneReason:'Advice just for you.',profileGallery:'',profileImageUrl:'/ella-profile.jpg',profileImagePositionX:50,profileImagePositionY:50,profileImageZoom:135,profileIntro:'Styling help for real life.',sessionOfferings:JSON.stringify([{id:'offer_quick',title:'Quick Styling Question',durationMinutes:15,unitAmount:1800,description:'One specific outfit question.',active:true}])};
  await sql(request,'UPDATE creator_onboarding_profiles SET profile_draft=?,draft_saved_at=? WHERE id=?',[JSON.stringify(draft),new Date().toISOString(),creatorId]);
}
async function publish(page:Page) { await page.getByRole('tab',{name:'Preview & Publish'}).click(); await page.getByRole('button',{name:/^Publish (profile|changes)$/}).click(); await expect(page.getByText('Your page is live. You can share it now.')).toBeVisible(); }
let observedPages = new Map<Page,string[]>();
let expectedHttp = new Map<Page,Set<string>>();
function expectHttpFailure(page:Page, path:string, status:number) {
  const allowed=expectedHttp.get(page) ?? new Set<string>();
  allowed.add(`${status} ${path}`); expectedHttp.set(page,allowed);
}
function observe(page:Page) {
  if(observedPages.has(page)) return observedPages.get(page)!;
  const failures:string[]=[]; observedPages.set(page,failures);
  const expected=(url:string,status:number)=>expectedHttp.get(page)?.has(`${status} ${new URL(url).pathname}`);
  page.on('pageerror',(error)=>failures.push(error.message));
  page.on('console',(message)=>{
    if(message.type()!=='error') return;
    const status=message.text().match(/server responded with a status of (\d+)/)?.[1];
    const url=message.location().url;
    if(status && url && expected(url,Number(status))) return;
    failures.push(`${message.text()} ${url}`);
  });
  page.on('requestfailed',(request)=>{if(!request.failure()?.errorText.includes('ERR_ABORTED')) failures.push(request.url());});
  page.on('response',(response)=>{if(response.status()>=400 && !expected(response.url(),response.status())) failures.push(`${response.status()} ${response.url()}`);});
  return failures;
}
test.beforeEach(async({request,page,context})=>{
  observedPages=new Map(); expectedHttp=new Map();
  observe(page); context.on('page',observe); await reset(request);
});
test.afterEach(()=>expect([...observedPages.values()].flat(),'Unexpected browser errors or HTTP failures').toEqual([]));

test('email account switch reloads Clerk before one-use redemption and preserves the saved profile',async({page,request})=>{
  await seedDraft(request);
  await page.goto('/creators/email-sign-in?invite=e2e-original-invite#ticket=e2e-email-ticket&email=creator%40example.com');
  await expect(page.getByRole('button',{name:'Switch to my creator account'})).toBeVisible();
  await page.getByRole('button',{name:'Switch to my creator account'}).click();
  await expect(page).toHaveURL(/\/creator\/profile\?invite=e2e-original-invite$/);
  await expect(page.getByLabel('Creator hero name')).toHaveValue('Published Creator');
  expect(await page.evaluate(()=>sessionStorage.getItem('tas_email_ticket_uses'))).toBe('1');
  await page.reload();
  await expect(page.getByLabel('About section')).toHaveValue('Thoughtful styling advice.');
  expect(await page.evaluate(()=>sessionStorage.getItem('tas_email_ticket_uses'))).toBe('1');
  expect((await sql(request,'SELECT published_at FROM creator_onboarding_profiles WHERE id=?',[creatorId]))[0].published_at).toBeNull();
});

test('acceptance destination, complete profile persistence, original media, draft/publish isolation and fresh login',async({page,request,browser})=>{
  const errors=observe(page);
  await sql(request,"UPDATE creator_onboarding_profiles SET application_status='in_review' WHERE id=?",[creatorId]);
  await page.context().addCookies([{name:'tas_local_admin',value:'1',url:'http://127.0.0.1:4173'}]);
  const accepted=await request.post('/api/creators/applications/accept',{form:{creatorId,publicCreatorId:'e2e-creator'},headers:{cookie:'tas_local_admin=1'},maxRedirects:0});
  expect(accepted.headers().location).toContain("email=sent");
  const emails=await sql(request,"SELECT payload FROM e2e_provider_events WHERE kind='email'");
  const inviteText=emails.map((row:{payload:string})=>JSON.parse(row.payload).text).find((text:string)=>text.includes('?invite='));
  const target=new URL(inviteText.match(/https?:\/\/\S+\?invite=\S+/)[0]);
  expect(target.pathname).toBe('/creator/profile');
  await page.context().clearCookies();
  await page.goto(target.pathname+target.search);
  await expect(page.getByText('Sign in to build your profile.')).toBeVisible();
  await login(page,target.pathname+target.search);
  await page.getByLabel('Creator hero name').fill('Studio Creator');
  await page.getByText('Social links',{exact:true}).click();
  await page.getByLabel('Instagram URL',{exact:true}).fill('https://www.instagram.com/studiocreator');
  await page.getByLabel('TikTok URL',{exact:true}).fill('https://www.tiktok.com/@studiocreator');
  await page.getByLabel('Public profile intro').fill('Confident outfits for everyday life.');
  await page.getByLabel('About section').fill('I help you find your personal style with practical, thoughtful advice.');
  await page.getByLabel('What people can ask').fill('Work outfits');
  await page.getByLabel('Help topic 2').fill('Trip packing');
  await page.getByText('Profile photo',{exact:true}).click();
  await expect(page.getByLabel('Upload profile picture',{exact:true})).toBeEnabled();
  await page.getByLabel('Upload profile picture',{exact:true}).setInputFiles(resolve('public/ella-profile.jpg'));
  await expect(page.getByLabel('Upload profile picture',{exact:true})).toBeEnabled();
  await expect(page.locator('.editable-profile-photo-frame img')).toHaveAttribute('src',/\/api\/creators\/media\//);
  await page.getByRole('button',{name:'Zoom profile picture in',exact:true}).click();
  const frame=await page.locator('.editable-profile-photo-frame').boundingBox();
  await page.mouse.move(frame!.x+70,frame!.y+70); await page.mouse.down(); await page.mouse.move(frame!.x+90,frame!.y+80); await page.mouse.up();
  const crop=await page.locator('.editable-profile-photo-frame img').evaluate((image)=>({position:getComputedStyle(image).objectPosition,transform:getComputedStyle(image).transform}));
  await page.getByText('Photos and videos',{exact:true}).first().click();
  for(const file of ['public/amber-reference-trench.png','public/amber-reference-brown-door.png']) {
    await page.getByLabel('Upload new media file').setInputFiles(resolve(file));
    await expect(page.getByRole('button',{name:'Add media',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'Add media',exact:true}).click();
  }
  await page.getByRole('button',{name:'Move media 2 up'}).click();
  await page.locator('.editable-media-row').first().getByRole('button',{name:'Remove',exact:true}).click();
  const media=await page.locator('.editable-media-row img').evaluateAll((nodes)=>nodes.map((node)=>node.getAttribute('src')));
  await page.getByLabel('Offering 1 title').fill('Quick Styling Question');
  await page.getByLabel('Offering 1 price').fill('18');
  await page.getByLabel('Offering 1 description').fill('For one specific outfit question.');
  await page.locator('.creator-offering-card').first().getByRole('checkbox').check();
  await save(page);
  await page.reload();
  await expect(page.getByLabel('Creator hero name')).toHaveValue('Studio Creator');
  await expect(page.getByLabel('Instagram URL',{exact:true})).toHaveValue('https://www.instagram.com/studiocreator');
  await expect(page.getByLabel('TikTok URL',{exact:true})).toHaveValue('https://www.tiktok.com/@studiocreator');
  await expect(page.getByLabel('About section')).toHaveValue('I help you find your personal style with practical, thoughtful advice.');
  await expect(page.getByLabel('Public profile intro')).toHaveValue('Confident outfits for everyday life.');
  await expect(page.getByLabel('Offering 1 price')).toHaveValue('18');
  expect(await page.locator('.editable-profile-photo-frame img').evaluate((image)=>({position:getComputedStyle(image).objectPosition,transform:getComputedStyle(image).transform}))).toEqual(crop);
  expect(await page.locator('.editable-media-row img').evaluateAll((nodes)=>nodes.map((node)=>node.getAttribute('src')))).toEqual(media);
  const source=await page.locator('.editable-profile-photo-frame img').getAttribute('src');
  expect(Buffer.from(await (await page.request.get(source!)).body())).toEqual(readFileSync(resolve('public/ella-profile.jpg')));
  await page.screenshot({path:'.wrangler/creator-profile-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({path:'.wrangler/creator-profile-mobile.png',fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await publish(page);
  const customer=await browser.newPage(); observe(customer); await customer.goto('http://127.0.0.1:4173/with/e2e-creator');
  await expect(customer.getByRole('heading',{name:'Studio Creator',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Profile',exact:true}).click(); await page.getByLabel('Creator hero name').fill('New Studio Creator'); await save(page);
  await customer.reload(); await expect(customer.getByRole('heading',{name:'Studio Creator',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Preview profile',exact:true}).click();
  await expect(page.frameLocator('iframe[title="Your customer profile preview"]').getByRole('heading',{name:'New Studio Creator',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('button',{name:'Back to setup'})).toBeVisible();
  await page.screenshot({path:'.wrangler/creator-preview-mobile.png'});
  await page.getByRole('button',{name:'Back to setup'}).click();
  await page.setViewportSize({width:1280,height:900});
  await publish(page); await expect(customer.getByRole('heading',{name:'Studio Creator',exact:true})).toBeVisible();
  await customer.reload(); await expect(customer.getByRole('heading',{name:'New Studio Creator',exact:true})).toBeVisible();
  await page.goto('/e2e-control?logout=1'); await expect(page.getByText('Sign in to build your profile.')).toBeVisible();
  const fresh=await browser.newPage(); observe(fresh); await fresh.goto('http://127.0.0.1:4173/e2e-control?login=1');
  await expect(fresh.getByLabel('Creator hero name')).toHaveValue('New Studio Creator');
  await expect(fresh.getByLabel('Offering 1 description')).toHaveValue('For one specific outfit question.');
  await customer.close(); await fresh.close(); expect(errors).toEqual([]);
});

test('failed save keeps edits and never claims success, then retry persists',async({page,request})=>{
  await seedDraft(request); await login(page); await page.getByLabel('Creator hero name').fill('Retry Creator');
  expectHttpFailure(page,'/api/creators/profile',503);
  await page.route('**/api/creators/profile',route=>route.fulfill({status:503,json:{status:'error'}}));
  await page.getByRole('button',{name:'Save draft',exact:true}).last().click();
  await expect(page.locator('.creator-profile-save-notice')).toContainText('couldn');
  await expect(page.locator('.creator-storefront-bar')).toContainText('Save failed');
  await expect(page.getByLabel('Creator hero name')).toHaveValue('Retry Creator');
  await page.unroute('**/api/creators/profile'); await page.getByRole('button',{name:'Retry Save draft'}).click();
  await expect(page.locator('.creator-storefront-bar')).toContainText('Saved at'); await page.reload();
  await expect(page.getByLabel('Creator hero name')).toHaveValue('Retry Creator');
});

test('default availability, dated override, timezone, one-year navigator and mobile layout',async({page,request})=>{
  await sql(request,'DELETE FROM creator_availability_rules');
  const errors=observe(page); await login(page); await page.getByRole('tab',{name:'Availability',exact:true}).click();
  await page.getByRole('button',{name:'Default weekly hours',exact:true}).click();
  await page.getByRole('button',{name:'Clear hours',exact:true}).click();
  for(const time of ['10:00','10:15','10:30','10:45']) await page.locator(`[data-availability-key="1|${time}"]`).press('Space');
  await page.getByPlaceholder('Search timezone').fill('America/New_York');
  await page.getByRole('button',{name:'Save availability',exact:true}).last().click();
  await expect(page.getByText('Availability saved for default weekly schedule.')).toBeVisible();
  await page.getByRole('tab',{name:'Preview & Publish'}).click();
  await expect(page.locator('.creator-setup-checklist li').filter({hasText:'Saved availability and Google Calendar'})).toContainText('Ready');
  await page.getByRole('tab',{name:'Availability',exact:true}).click();
  await page.getByRole('button',{name:'Week overrides',exact:true}).click();
  await page.getByRole('button',{name:'Next availability week'}).click();
  const week=await page.getByLabel('Choose availability week').inputValue();
  await page.getByRole('button',{name:'Clear hours',exact:true}).click();
  await page.getByRole('button',{name:'Save availability',exact:true}).last().click();
  await expect(page.getByText(/Availability saved for/)).toBeVisible();
  await page.reload(); await page.getByRole('tab',{name:'Availability',exact:true}).click();
  await page.getByLabel('Choose availability week').selectOption(week);
  await expect(page.locator('[data-availability-key][aria-pressed=true]')).toHaveCount(0);
  await page.getByRole('button',{name:'Default weekly hours',exact:true}).click();
  await expect(page.locator('[data-availability-key][aria-pressed=true]')).toHaveCount(4);
  await expect(page.getByPlaceholder('Search timezone')).toHaveValue('America/New_York');
  const max=await page.getByLabel('Jump to availability date').getAttribute('max');
  expect(Date.parse(max!)-Date.now()).toBeGreaterThan(360*86400000);
  await page.getByLabel('Jump to availability date').fill(max!);
  await expect(page.getByLabel('Choose availability week')).not.toHaveValue('default');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({path:'.wrangler/creator-availability-mobile.png'});
  expect(errors).toEqual([]);
});

test('Stripe state reflects provider readiness rather than saved flag',async({page,request})=>{
  const errors=observe(page); await login(page); await page.getByRole('tab',{name:'Payments',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Connected to Stripe ✓'})).toBeVisible();
  await expect(page.getByText('$123.45',{exact:true})).toBeVisible();
  await sql(request,"UPDATE e2e_state SET value='restricted' WHERE id='stripe'");
  await page.getByRole('button',{name:'Refresh Stripe status'}).click(); await expect(page.getByRole('heading',{name:'Action required',exact:true})).toBeVisible();
  await sql(request,'DELETE FROM creator_stripe_connections');
  await page.getByRole('button',{name:'Refresh Stripe status'}).click(); await expect(page.getByRole('heading',{name:'Not connected',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('protected customer flow, immutable purchase, request acceptance/decline, races and stale slots',async({page,request,browser})=>{
  const errors=observe(page); await seedDraft(request); await login(page); await publish(page);
  const customer=await browser.newPage({viewport:{width:1280,height:900}}); const customerErrors=observe(customer);
  await customer.goto('http://127.0.0.1:4173/with/e2e-creator');
  await expect(customer.getByRole('button',{name:/Quick Styling Question/})).toContainText('$18');
  await expect(customer.getByRole('button',{name:/Quick Styling Question/})).toContainText('One specific outfit question.');
  await customer.getByRole('button',{name:'Find availability'}).click();
  await expect(customer.getByRole('dialog')).toContainText('Find your moment');
  await customer.locator('.customer-time-options button').first().click();
  await customer.screenshot({path:'.wrangler/customer-time-after.png'});
  await customer.getByRole('button',{name:'Continue',exact:true}).click();
  await customer.getByLabel('Name',{exact:true}).fill('Customer One');
  await customer.getByLabel('Email address',{exact:true}).fill('customer@example.com');
  await customer.getByLabel(/What do you want to talk about/).fill('Help me pack for a trip.');
  const appointment=await customer.locator('input[name=appointmentStartAt]').inputValue();
  await customer.getByRole('button',{name:/Continue to payment/}).click();
  await expect(customer.getByText('Payment authorized in the isolated Stripe fixture.')).toBeVisible();
  await page.getByRole('tab',{name:'Requests',exact:true}).click(); await page.getByRole('button',{name:'Refresh requests'}).click();
  const card=page.locator('.creator-request-card:visible').filter({hasText:'Customer One'});
  await expect(card).toContainText('Help me pack for a trip.');
  await card.getByRole('button',{name:'Accept request',exact:true}).click(); await expect(card).toContainText('Booked');
  await page.reload(); await page.getByRole('tab',{name:'Requests',exact:true}).click(); await expect(page.locator('.creator-request-card:visible').filter({hasText:'Customer One'})).toContainText('Booked');
  const [booking]=await sql(request,"SELECT * FROM customer_bookings WHERE customer_name='Customer One'");
  // Idempotent repeated requests never capture or create a second event.
  const cookie={cookie:'tas_e2e_creator=1'};
  await Promise.all([1,2].map(()=>request.post('/api/creators/requests',{form:{bookingId:booking.id,action:'accept',returnTo:'/creator/profile'},headers:cookie})));
  expect((await sql(request,"SELECT * FROM e2e_provider_events WHERE kind='capture'")).length).toBe(1);
  await page.getByRole('tab',{name:'Profile',exact:true}).click(); await page.getByLabel('Offering 1 price').fill('29'); await save(page); await publish(page);
  const [historical]=await sql(request,'SELECT offering_unit_amount,seat_name,offering_duration_minutes FROM customer_bookings WHERE id=?',[booking.id]);
  expect(historical).toEqual({offering_unit_amount:1800,seat_name:'Quick Styling Question',offering_duration_minutes:15});
  await page.getByRole('tab',{name:'Payments',exact:true}).click(); await page.getByRole('button',{name:'Refresh Stripe status'}).click();
  await expect(page.locator('.creator-request-card:visible').filter({hasText:'Customer One'})).toContainText('$18.00');
  // Two independent customers contend for the same newly available slot.
  const next=new Date(`${appointment}Z`);next.setUTCDate(next.getUTCDate()+1);
  const payload={creatorId,seatId:'offer_quick',appointmentStartAt:next.toISOString().slice(0,19),timezone:'America/Los_Angeles',customerEmail:'race@example.com',customerName:'Race Customer',customerNote:'Race test',returnTo:'/with/e2e-creator'};
  const results=await Promise.all([1,2].map(()=>request.post('/api/bookings/request',{form:payload,maxRedirects:0})));
  const winners=results.filter((result)=>result.headers().location?.includes('checkout='));
  expect(winners).toHaveLength(1);
  expect(results.filter((result)=>result.headers().location?.includes('detail=availability'))).toHaveLength(1);
  await request.get(winners[0].headers().location);
  await page.getByRole('tab',{name:'Requests',exact:true}).click(); await page.getByRole('button',{name:'Refresh requests'}).click();
  const declineCard=page.locator('.creator-request-card:visible').filter({hasText:'Race Customer'});
  await declineCard.getByRole('button',{name:'Decline',exact:true}).click(); await expect(declineCard).toContainText('Declined');
  await page.reload(); await page.getByRole('tab',{name:'Requests',exact:true}).click(); await expect(page.locator('.creator-request-card:visible').filter({hasText:'Race Customer'})).toContainText('Declined');
  expect((await sql(request,"SELECT * FROM e2e_provider_events WHERE kind='cancel'")).length).toBe(1);
  const [declinedBooking]=await sql(request,"SELECT id FROM customer_bookings WHERE customer_name='Race Customer'");
  await customer.goto(`/bookings/${declinedBooking.id}`);
  await expect(customer.getByRole('heading',{name:'Request declined.',exact:true})).toBeVisible();
  await expect(customer.getByText(/no payment was captured/)).toBeVisible();
  await customer.reload();
  await expect(customer.getByRole('heading',{name:'Request declined.',exact:true})).toBeVisible();
  await expect(customer.getByText(/Payment authorization is still required/)).toHaveCount(0);
  await customer.getByRole('link',{name:'Creator',exact:true}).click();
  await expect(customer).toHaveURL(/\/with\/e2e-creator$/);
  await expect(customer.getByRole('button',{name:'Find availability'})).toBeVisible();
  await page.goto(`/bookings/${declinedBooking.id}`);
  await expect(page.getByRole('button',{name:'Accept this appointment',exact:true})).toHaveCount(0);
  // A customer's loaded page remains valid; its stale time is rejected at submit.
  await customer.goto('http://127.0.0.1:4173/with/e2e-creator');
  await customer.getByRole('button',{name:'Find availability'}).click(); await customer.locator('.customer-time-options button').last().click();
  await customer.getByRole('button',{name:'Continue',exact:true}).click();
  await customer.getByLabel('Name',{exact:true}).fill('Stale Customer'); await customer.getByLabel('Email address',{exact:true}).fill('stale@example.com'); await customer.getByLabel(/What do you want to talk about/).fill('A stale time.');
  await sql(request,'DELETE FROM creator_availability_rules WHERE creator_id=?',[creatorId]);
  await customer.getByRole('button',{name:/Continue to payment/}).click(); await expect(customer.getByText('That time is no longer available. Please choose another.')).toBeVisible();
  expect((await sql(request,"SELECT * FROM customer_bookings WHERE customer_name='Stale Customer'")).length).toBe(0);
  await customer.setViewportSize({width:390,height:844}); await customer.getByRole('button',{name:'Find availability'}).click();
  await expect(customer.getByRole('dialog')).toBeVisible(); expect(await customer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await customer.screenshot({path:'.wrangler/customer-time-mobile-after.png'});
  expect(errors).toEqual([]); expect(customerErrors).toEqual([]); await customer.close();
});

test('an abandoned checkout is released only after Stripe confirms expiry',async({page,request})=>{
  await seedDraft(request);await login(page);await publish(page);
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+2);const date=tomorrow.toISOString().slice(0,10);
  await sql(request,"INSERT INTO customer_bookings (id,creator_id,creator_name,seat_id,seat_name,customer_email,appointment_start_at,appointment_end_at,timezone,status,stripe_checkout_session_id,created_at) VALUES ('booking_expired',?,'Published Creator','offer_quick','Quick Styling Question','expired@example.com',?,?,'America/Los_Angeles','requested','cs_expired',?)",[creatorId,`${date}T09:00:00`,`${date}T09:15:00`,new Date(Date.now()-3600000).toISOString()]);
  const response=await request.post('/api/bookings/request',{form:{creatorId,seatId:'offer_quick',appointmentStartAt:`${date}T09:00:00`,timezone:'America/Los_Angeles',customerEmail:'new@example.com'},maxRedirects:0});
  expect(response.headers().location).toContain('checkout=');
  expect((await sql(request,"SELECT status FROM customer_bookings WHERE id='booking_expired'"))[0].status).toBe('checkout_expired');
});


test('multiple offerings retain order and archive without exposing inactive sessions',async({page,request,browser})=>{
  const errors=observe(page); await seedDraft(request); await login(page);
  await page.getByRole('button',{name:'Add offering',exact:true}).click();
  await page.getByLabel('Offering 2 title').fill('Closet planning');
  await page.getByLabel('Offering 2 duration').selectOption('45');
  await page.getByLabel('Offering 2 price').fill('65');
  await page.getByLabel('Offering 2 description').fill('Plan a complete week of outfits.');
  await page.locator('.creator-offering-card').nth(1).getByRole('checkbox').check();
  await page.getByRole('button',{name:'Move offering 2 up'}).click(); await save(page); await page.reload();
  await expect(page.getByLabel('Offering 1 title')).toHaveValue('Closet planning');
  await expect(page.getByLabel('Offering 1 duration')).toHaveValue('45');
  await publish(page);
  const customer=await browser.newPage(); observe(customer); await customer.goto('http://127.0.0.1:4173/with/e2e-creator');
  await expect(customer.getByRole('button',{name:/Closet planning/})).toContainText('45 min');
  await expect(customer.getByRole('button',{name:/Closet planning/})).toContainText('$65');
  await page.getByRole('tab',{name:'Profile',exact:true}).click();
  await page.locator('.creator-offering-card').first().getByRole('button',{name:'Archive',exact:true}).click(); await save(page); await publish(page);
  await customer.reload(); await expect(customer.getByRole('button',{name:/Closet planning/})).toHaveCount(0);
  await expect(customer.getByRole('button',{name:/Quick Styling Question/})).toBeVisible();
  await page.reload(); await expect(page.locator('.creator-offering-card').first()).toContainText('Archived');
  await customer.close(); expect(errors).toEqual([]);
});


test('duplicate and unsupported media show recovery without ghost items',async({page,request})=>{
  await seedDraft(request); await login(page);
  await page.getByText('Photos and videos',{exact:true}).first().click();
  const file=resolve('public/amber-reference-trench.png');
  await page.getByLabel('Upload new media file').setInputFiles(file);
  await page.getByRole('button',{name:'Add media',exact:true}).click();
  await expect(page.locator('.editable-media-row')).toHaveCount(1);
  await page.getByLabel('Upload new media file').setInputFiles(file);
  await expect(page.getByText('That file is already in your gallery.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Add media',exact:true})).toBeDisabled();
  await page.getByLabel('Upload new media file').setInputFiles({name:'unsupported.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
  await expect(page.getByText('Use a JPG, PNG, WebP photo or MP4/WebM video.',{exact:true})).toBeVisible();
  await save(page); await page.reload(); await expect(page.locator('.editable-media-row')).toHaveCount(1);
});

test('slow save preserves newer edits and double clicks send one write', async ({page,request}) => {
  const errors=observe(page); await seedDraft(request); await login(page);
  let release!: () => void;
  const gate=new Promise<void>((resolve)=>{ release=resolve; });
  let writes=0;
  await page.route('**/api/creators/profile',async route=>{ writes++; await gate; await route.continue(); });
  await page.getByLabel('Creator hero name').fill('First revision');
  await page.getByRole('button',{name:'Save draft',exact:true}).last().dblclick();
  await expect.poll(()=>writes).toBe(1);
  await expect(page.locator('.creator-storefront-bar')).toContainText('Saving');
  await page.getByLabel('Creator hero name').fill('Newer revision');
  release();
  await expect(page.locator('.creator-storefront-bar')).toContainText('Unsaved');
  await expect(page.getByLabel('Creator hero name')).toHaveValue('Newer revision');
  const [stored]=await sql(request,'SELECT profile_draft FROM creator_onboarding_profiles WHERE id=?',[creatorId]);
  expect(JSON.parse(stored.profile_draft).name).toBe('First revision');
  await page.unroute('**/api/creators/profile'); await save(page); await page.reload();
  await expect(page.getByLabel('Creator hero name')).toHaveValue('Newer revision');
  expect(errors).toEqual([]);
});

test('saved default timezone carries into untouched weeks before and after refresh', async ({page,request})=>{
  const errors=observe(page); await seedDraft(request); await login(page);
  await page.getByRole('tab',{name:'Availability',exact:true}).click();
  await page.getByRole('button',{name:'Default weekly hours',exact:true}).click();
  await page.getByPlaceholder('Search timezone').fill('America/New_York');
  await page.getByRole('button',{name:'Save availability',exact:true}).last().click();
  await expect(page.getByText('Availability saved for default weekly schedule.')).toBeVisible();
  await page.getByRole('button',{name:'Week overrides',exact:true}).click();
  await page.getByRole('button',{name:'Next availability week'}).click();
  const week=await page.getByLabel('Choose availability week').inputValue();
  await expect(page.getByPlaceholder('Search timezone')).toHaveValue('America/New_York');
  await page.reload(); await page.getByRole('tab',{name:'Availability',exact:true}).click();
  await page.getByLabel('Choose availability week').selectOption(week);
  await expect(page.getByPlaceholder('Search timezone')).toHaveValue('America/New_York');
  expect(errors).toEqual([]);
});

async function prepareCustomer(page:Page, name:string) {
  await page.goto('http://127.0.0.1:4173/with/e2e-creator');
  await page.getByRole('button',{name:'Find availability'}).click();
  await page.locator('.customer-time-options button').first().click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill(name);
  await page.getByLabel('Email address',{exact:true}).fill(`${name.toLowerCase()}@example.com`);
  await page.getByLabel(/What do you want to talk about/).fill('Help with an outfit.');
}

test('isolated customers contend through the UI and opposite creator decisions stay atomic',async({page,request,browser})=>{
  await seedDraft(request); await login(page); await publish(page);
  const a=await browser.newContext(), b=await browser.newContext();
  const first=await a.newPage(),second=await b.newPage();
  const errors=[observe(page),observe(first),observe(second)];
  await Promise.all([prepareCustomer(first,'First'),prepareCustomer(second,'Second')]);
  expect(await first.locator('input[name=appointmentStartAt]').inputValue()).toBe(await second.locator('input[name=appointmentStartAt]').inputValue());
  await Promise.all([first.getByRole('button',{name:/Continue to payment/}).click(),second.getByRole('button',{name:/Continue to payment/}).click()]);
  await expect.poll(async()=> (await sql(request,'SELECT status FROM customer_bookings')).map((r:{status:string})=>r.status)).toEqual(['payment_authorized']);
  const [booking]=await sql(request,'SELECT * FROM customer_bookings');
  const winner=booking.customer_name==='First'?first:second, loser=winner===first?second:first;
  await expect(winner.getByText('Payment authorized in the isolated Stripe fixture.')).toBeVisible();
  await expect(loser.getByText('That time is no longer available. Please choose another.')).toBeVisible();
  const other=await page.context().newPage(); errors.push(observe(other)); await other.goto('/creator/profile');
  for(const p of [page,other]) { await p.getByRole('tab',{name:'Requests',exact:true}).click(); await p.getByRole('button',{name:'Refresh requests'}).click(); }
  const accept=page.locator('.creator-request-card:visible').getByRole('button',{name:'Accept request',exact:true});
  const decline=other.locator('.creator-request-card:visible').getByRole('button',{name:'Decline',exact:true});
  expectHttpFailure(page,'/api/creators/requests',409); expectHttpFailure(other,'/api/creators/requests',409);
  // The losing action deliberately returns a conflict response.
  const responses=await Promise.all([
    page.waitForResponse(r=>r.url().endsWith('/api/creators/requests') && r.request().method()==='POST'),
    other.waitForResponse(r=>r.url().endsWith('/api/creators/requests') && r.request().method()==='POST'),
    accept.click(),decline.click(),
  ]);
  expect(responses.slice(0,2).map(r=>r!.status()).sort()).toEqual([200,409]);
  const rejected=responses[0]!.status()===409?page:other;
  await expect(rejected.getByRole('alert')).toBeVisible();
  await expect.poll(async()=> (await sql(request,'SELECT status FROM customer_bookings'))[0].status).toMatch(/^(approved|declined)$/);
  const events=await sql(request,"SELECT kind FROM e2e_provider_events WHERE kind IN ('capture','cancel')");
  expect(events).toHaveLength(1);
  await page.reload(); await other.reload();
  for(const p of [page,other]) { await p.getByRole('tab',{name:'Requests',exact:true}).click(); await expect(p.locator('.creator-request-card:visible')).toContainText(events[0].kind==='capture'?'Booked':'Declined'); }
  // Only the asserted conflict from the competing decision is expected.
  expect(errors.flat()).toEqual([]);
  await a.close(); await b.close(); await other.close();
});

test('a stale creator tab cannot overwrite or publish another tab saved edits',async({page,request})=>{
  await seedDraft(request); await login(page);
  const other=await page.context().newPage(); await other.goto('/creator/profile');
  await page.getByLabel('Creator hero name').fill('Saved in first tab'); await save(page);
  expectHttpFailure(other,'/api/creators/profile',409);
  await other.getByLabel('About section').fill('Changed in a stale second tab');
  await other.getByRole('button',{name:'Save draft',exact:true}).last().click();
  await expect(other.locator('.creator-profile-save-notice')).toContainText('another');
  const [stored]=await sql(request,'SELECT profile_draft FROM creator_onboarding_profiles WHERE id=?',[creatorId]);
  expect(JSON.parse(stored.profile_draft).name).toBe('Saved in first tab');
  await expect(other.getByLabel('About section')).toHaveValue('Changed in a stale second tab');
  // An editor loaded before revision support cannot bypass the server guard.
  const legacy=await request.post('/api/creators/profile',{form:{creatorId,email:'creator@example.com',name:'Old browser overwrite'},headers:{cookie:'tas_e2e_creator=1',accept:'application/json'}});
  expect(legacy.status()).toBe(409);
  await other.setViewportSize({width:390,height:844});
  expect(await other.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await other.evaluate(()=>window.scrollTo(0,0));
  await other.screenshot({path:'.wrangler/creator-conflict-mobile.png'});
  await other.setViewportSize({width:1280,height:900});
  await other.evaluate(()=>window.scrollTo(0,0));
  await other.screenshot({path:'.wrangler/creator-conflict-desktop.png'});
  await other.getByRole('tab',{name:'Preview & Publish'}).click();
  await other.getByRole('button',{name:'Publish profile',exact:true}).click();
  await expect(other.getByText('Your page is live. You can share it now.')).toHaveCount(0);
  await expect(other.locator('.creator-profile-save-notice')).toContainText('another');
  expect((await sql(request,'SELECT published_at FROM creator_onboarding_profiles WHERE id=?',[creatorId]))[0].published_at).toBeNull();
  await other.close();
});

test('publish trusts current Stripe readiness even when the profile timestamp is stale',async({page,request})=>{
  await seedDraft(request); await sql(request,'UPDATE creator_onboarding_profiles SET stripe_connected_at=NULL WHERE id=?',[creatorId]);
  await login(page); await publish(page);
  expect((await sql(request,'SELECT published_at FROM creator_onboarding_profiles WHERE id=?',[creatorId]))[0].published_at).toBeTruthy();
});

test('private media stays private, profile replacement persists and upload failure recovers',async({page,request,browser})=>{
  await seedDraft(request); await login(page);
  await expect(page.getByLabel('Upload profile picture',{exact:true})).toBeEnabled();
  await page.getByLabel('Upload profile picture',{exact:true}).setInputFiles(resolve('public/ella-profile.jpg'));
  await expect(page.locator('.editable-profile-photo-frame img')).toHaveAttribute('src',/\/api\/creators\/media\//);
  await save(page);
  const original=await page.locator('.editable-profile-photo-frame img').getAttribute('src');
  const customer=await browser.newContext();
  expect((await customer.request.get(`http://127.0.0.1:4173${original}`)).status()).toBe(404);
  await publish(page);
  expect((await customer.request.get(`http://127.0.0.1:4173${original}`)).status()).toBe(200);
  await page.getByRole('tab',{name:'Profile',exact:true}).click();
  expectHttpFailure(page,'/api/creators/media',503);
  await page.route('**/api/creators/media',route=>route.fulfill({status:503,json:{error:'Upload unavailable. Retry.'}}));
  await expect(page.getByLabel('Upload profile picture',{exact:true})).toBeEnabled();
  await page.getByLabel('Upload profile picture',{exact:true}).setInputFiles(resolve('public/amber-reference-trench.png'));
  await expect(page.getByText('Upload unavailable. Retry.',{exact:true})).toBeVisible();
  await expect(page.locator('.editable-profile-photo-frame img')).toHaveAttribute('src',original!);
  await page.unroute('**/api/creators/media');
  await expect(page.getByLabel('Upload profile picture',{exact:true})).toBeEnabled();
  await page.getByLabel('Upload profile picture',{exact:true}).setInputFiles(resolve('public/amber-reference-trench.png'));
  await expect(page.locator('.editable-profile-photo-frame img')).not.toHaveAttribute('src',original!);
  await save(page); const replacement=await page.locator('.editable-profile-photo-frame img').getAttribute('src');
  await page.reload(); await expect(page.locator('.editable-profile-photo-frame img')).toHaveAttribute('src',replacement!);
  expect((await customer.request.get(`http://127.0.0.1:4173${replacement}`)).status()).toBe(404);
  await publish(page);
  expect((await customer.request.get(`http://127.0.0.1:4173${replacement}`)).status()).toBe(200);
  expect((await customer.request.get(`http://127.0.0.1:4173${original}`)).status()).toBe(404);
  await customer.close();
});

test('expired creator session cannot save; reauthentication retains destination and pending edits',async({page,request})=>{
  await seedDraft(request); await login(page,'/creator/profile?section=profile');
  await page.getByLabel('Creator hero name').fill('After returning login');
  await page.context().clearCookies();
  expectHttpFailure(page,'/api/creators/profile',400);
  await page.getByRole('button',{name:'Save draft',exact:true}).last().click();
  await expect(page.locator('.creator-profile-save-notice')).toContainText('sign-in');
  expect(JSON.parse((await sql(request,'SELECT profile_draft FROM creator_onboarding_profiles WHERE id=?',[creatorId]))[0].profile_draft).name).toBe('Published Creator');
  for(const path of ['/api/creators/requests','/api/creators/payments']) {
    const response=await page.request.get(`${path}?creatorId=${creatorId}`); expect(response.status()).toBe(403);
  }
  const second=await page.context().newPage(); await login(second,'/creator/profile?section=profile');
  expect(new URL(second.url()).searchParams.get('section')).toBe('profile');
  await page.getByRole('button',{name:'Retry Save draft'}).click();
  await expect(page.locator('.creator-storefront-bar')).toContainText('Saved at');
  await page.reload(); await expect(page.getByLabel('Creator hero name')).toHaveValue('After returning login');
  await page.goto('/about'); await page.goBack(); await expect(page.getByLabel('Creator hero name')).toHaveValue('After returning login');
  await page.goForward(); await expect(page).toHaveURL(/\/about$/);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  await expect(page.getByRole('button',{name:'Open navigation',exact:true})).toHaveAttribute('aria-expanded','true');
  await second.close();
});

test('Stripe provider failure clears readiness and recovery rechecks the server',async({page,request})=>{
  await seedDraft(request); await login(page); await page.getByRole('tab',{name:'Payments',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Connected to Stripe ✓'})).toBeVisible();
  await sql(request,"UPDATE e2e_state SET value='error' WHERE id='stripe'");
  expectHttpFailure(page,'/api/creators/payments',503);
  await page.getByRole('button',{name:'Refresh Stripe status'}).click();
  await expect(page.getByRole('heading',{name:'Stripe status unavailable'})).toBeVisible();
  await page.getByRole('tab',{name:'Preview & Publish'}).click();
  await expect(page.getByRole('button',{name:'Publish profile',exact:true})).toBeDisabled();
  await sql(request,"UPDATE e2e_state SET value='active' WHERE id='stripe'");
  await page.getByRole('tab',{name:'Payments',exact:true}).click();
  await page.getByRole('button',{name:'Refresh Stripe status'}).click();
  await expect(page.getByRole('heading',{name:'Connected to Stripe ✓'})).toBeVisible();
  await publish(page);
});

test('signed duplicate webhooks preserve one authorization, capture, notification and calendar event',async({page,request})=>{
  await seedDraft(request); await login(page); await publish(page);
  const day=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
  const checkout=await request.post('/api/bookings/request',{form:{creatorId,seatId:'offer_quick',appointmentStartAt:`${day}T09:00:00`,timezone:'America/Los_Angeles',customerEmail:'webhook@example.com',customerName:'Webhook Customer'},maxRedirects:0});
  expect(checkout.headers().location).toContain('checkout=');
  const [booking]=await sql(request,'SELECT * FROM customer_bookings');
  const body=JSON.stringify({id:'evt_replayed',type:'checkout.session.completed',data:{object:{id:booking.stripe_checkout_session_id,client_reference_id:booking.id}}});
  const timestamp=Math.floor(Date.now()/1000);
  const signature=createHmac('sha256','whsec_e2e_fixture').update(`${timestamp}.${body}`).digest('hex');
  const send=()=>request.post('/api/stripe/webhook',{data:body,headers:{'stripe-signature':`t=${timestamp},v1=${signature}`,'content-type':'application/json'}});
  for(const response of await Promise.all([send(),send()])) expect(response.status(),await response.text()).toBe(200);
  expect((await sql(request,'SELECT status FROM customer_bookings'))).toEqual([{status:'payment_authorized'}]);
  expect((await sql(request,"SELECT * FROM creator_notifications WHERE type='booking_requested'"))).toHaveLength(1);
  expect((await sql(request,"SELECT * FROM e2e_provider_events WHERE id=?",[`take-a-seat-booking-request-${booking.id}`]))).toHaveLength(1);
  await page.getByRole('tab',{name:'Requests',exact:true}).click(); await page.getByRole('button',{name:'Refresh requests'}).click();
  await page.locator('.creator-request-card:visible').getByRole('button',{name:'Accept request',exact:true}).click();
  await expect(page.locator('.creator-request-card:visible')).toContainText('Booked');
  for(const response of await Promise.all([send(),send()])) expect(response.status()).toBe(200);
  expect((await sql(request,'SELECT status FROM customer_bookings'))).toEqual([{status:'approved'}]);
  for(const kind of ['capture','calendar']) expect(await sql(request,'SELECT * FROM e2e_provider_events WHERE kind=?',[kind])).toHaveLength(1);
  expect(await sql(request,"SELECT * FROM creator_notifications WHERE type='booking_paid'")).toHaveLength(1);
  const invalid=await request.post('/api/stripe/webhook',{data:body,headers:{'stripe-signature':`t=${timestamp},v1=invalid`}}); expect(invalid.status()).toBe(400);
  await page.reload(); await page.getByRole('tab',{name:'Requests',exact:true}).click(); await expect(page.locator('.creator-request-card:visible')).toContainText('Booked');
});

test('repeated Publish clicks commit one coherent public version',async({page,request})=>{
  await seedDraft(request); await login(page); await page.getByRole('tab',{name:'Preview & Publish'}).click();
  let publishes=0; page.on('request',req=>{if(req.url().endsWith('/api/creators/profile') && req.postData()?.includes('publish')) publishes++;});
  await page.getByRole('button',{name:'Publish profile',exact:true}).dblclick();
  await expect(page.getByText('Your page is live. You can share it now.')).toBeVisible();
  expect(publishes).toBe(1);
  const [stored]=await sql(request,'SELECT name,profile_intro,session_offerings,published_at FROM creator_onboarding_profiles WHERE id=?',[creatorId]);
  expect(stored.name).toBe('Published Creator'); expect(stored.profile_intro).toBe('Styling help for real life.');
  expect(JSON.parse(stored.session_offerings)[0].unitAmount).toBe(1800); expect(stored.published_at).toBeTruthy();
});

test('native gallery disclosure cannot mutate server markup while hydration is delayed',async({page,request})=>{
  await seedDraft(request);
  await page.context().addCookies([{name:'tas_e2e_creator',value:'1',url:'http://127.0.0.1:4173'}]);
  let release!:()=>void; const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/*',async route=>{ if(route.request().resourceType()==='script') await gate; await route.continue(); });
  await page.goto('/creator/profile',{waitUntil:'commit'});
  const main=page.locator('main'); await expect(main).toHaveAttribute('inert','');
  const summary=page.getByText('Photos and videos',{exact:true}).first();
  await summary.scrollIntoViewIfNeeded(); const box=await summary.boundingBox();
  await page.mouse.click(box!.x+box!.width/2,box!.y+box!.height/2);
  await expect(page.locator('.editable-gallery-controls')).not.toHaveAttribute('open','');
  release(); await expect(main).not.toHaveAttribute('inert','');
  await summary.click(); await expect(page.locator('.editable-gallery-controls')).toHaveAttribute('open','');
});
