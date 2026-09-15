import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e', testMatch:'**/*.spec.ts', fullyParallel:false, workers:1, retries:0,
  timeout:60000, expect:{timeout:10000}, reporter:[['list'],['html',{outputFolder:'.wrangler/playwright-report',open:'never'}]],
  outputDir:'.wrangler/playwright-results',
  use:{baseURL:'http://127.0.0.1:4173',browserName:'chromium',channel:'chrome',viewport:{width:1280,height:900},trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'node tests/e2e/server.mjs',url:'http://127.0.0.1:4173/creator/profile',timeout:120000,reuseExistingServer:false},
});
