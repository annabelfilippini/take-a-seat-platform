import { cp, mkdir, mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { port, baseURL } from './environment.mjs';
// Every invocation owns its directory. Never erase another running test's D1.
const root = await mkdtemp(resolve(tmpdir(), 'take-a-seat-e2e-'));
console.log(`Isolated fixture app: ${root} (${baseURL})`);
try { await symlink(resolve("node_modules"),resolve(root,"node_modules"),"dir"); } catch(error) { if(error.code !== "EEXIST") throw error; }
for (const name of ['app','db','drizzle','worker','public','tests/e2e']) {
  await rm(resolve(root,name), { recursive:true, force:true });
  await cp(resolve(name),resolve(root,name),{recursive:true});
}
for (const name of ['vite.config.ts','package.json','tsconfig.json','next.config.ts']) {
  try { await cp(resolve(name),resolve(root,name)); } catch (error) { if(error.code !== 'ENOENT') throw error; }
}
await writeFile(resolve(root,'.dev.vars'), `NEXT_PUBLIC_SITE_URL=${baseURL}\n` + 'TAKE_A_SEAT_DEV_ADMIN_ENABLED=true\nZOOM_ACCOUNT_ID=e2e\nZOOM_CLIENT_ID=e2e\nZOOM_CLIENT_SECRET=e2e\nZOOM_HOST_USER_IDS=["host_e2e"]\nSTRIPE_BOOKING_PAYMENT_METHOD_CONFIGURATION=pmc_e2e\nSTRIPE_SECRET_KEY=sk_test_e2e_fixture\nSTRIPE_WEBHOOK_SECRET=whsec_e2e_fixture\nTAKE_A_SEAT_PLATFORM_FEE_BPS=1500\nGOOGLE_TOKEN_ENCRYPTION_KEY=e2e_fixture\nGOOGLE_CLIENT_ID=e2e_client.apps.googleusercontent.com\nGOOGLE_CLIENT_SECRET=e2e_secret\nRESEND_API_KEY=e2e_fixture\nTAKE_A_SEAT_EMAIL_FROM=Take a Seat <test@example.com>\n');
// The production config and source tree never load the fixture identities/providers.
let config = await readFile(resolve(root,'vite.config.ts'),'utf8');
config = 'import { e2ePlugin } from "./tests/e2e/vite-plugin";\n' + config;
config = config.replace('      vinext(),','      e2ePlugin(),\n      vinext(),');
await writeFile(resolve(root,'vite.config.ts'),config);
await mkdir(resolve(root,'app/e2e-control'),{recursive:true});
await writeFile(resolve(root,'app/e2e-control/route.ts'), (await readFile(resolve('tests/e2e/control-route.ts'),'utf8')).replaceAll('../../app/_lib/','../_lib/'));
const child = spawn(process.execPath,[resolve('node_modules/vinext/dist/cli.js'),'dev','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>child.kill(signal));
child.on('exit',async(code)=>{ await rm(root,{recursive:true,force:true}); process.exit(code ?? 0); });
