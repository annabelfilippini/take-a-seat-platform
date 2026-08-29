import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Take a Seat platform", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Take a Seat<\/title>/i);
  assert.match(html, />take a seat</);
  assert.doesNotMatch(html, /with the ones to watch/);
  assert.match(html, /hero-chair\.png/);
  assert.match(html, /seat-mark\.png/);
  assert.match(html, /amber-card\.png/);
  assert.match(html, /category-top-experts\.png/);
  assert.match(html, /category-food\.png/);
  assert.match(html, /Top Experts/);
  assert.doesNotMatch(html, /Booking Now/);
  assert.match(html, /Style &amp; Beauty/);
  assert.match(html, /Home Interiors/);
  assert.match(html, /Amber May Lowe/);
  assert.match(html, /View profile/);
  assert.match(html, /\/with\/amber\//);
  assert.doesNotMatch(html, /Verified creator|&#10003;|✓/);
  assert.match(html, /Abby Catlin/);
  assert.match(html, /Alex Earl/);
  assert.match(html, /£45 • 15 minutes/);
  assert.match(html, /Apply to become a creator/);
  assert.match(html, /Interested in sharing your knowledge/);
  assert.doesNotMatch(html, /Book<\/a>|href="#booking"|id="booking"|Request this seat|Buy It Once/);
  assert.doesNotMatch(html, /Access to the people you already trust/);
  assert.doesNotMatch(html, /seats shown|booking now,\s*<!-- -->3<!-- -->\s*opening soon/i);
  assert.doesNotMatch(
    html,
    /Fifteen minutes\s*with the person you\s*already follow/i,
  );
  assert.doesNotMatch(html, /react-loading-skeleton|codex-preview|SkeletonPreview/);
});

test("removes starter metadata and preview dependencies", async () => {
  const [page, layout, packageJson, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /export const metadata:\s*Metadata/);
  assert.match(page, /<BookingPlatform \/>/);
  assert.match(layout, /title:\s*"Take a Seat"/);
  assert.match(packageJson, /"name": "take-a-seat-platform"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(css, /#020617|codex-preview|SkeletonPreview/i);
});

test("server-renders Amber's profile page", async () => {
  const response = await render("/with/amber");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Take a Seat with Amber May Lowe<\/title>/i);
  assert.match(html, /Amber May Lowe/);
  assert.match(html, /@ambermaylowe/);
  assert.match(html, /About/);
  assert.match(html, /Amber has a calm way of making clothes feel simpler/);
  assert.match(html, /Buy It Once/);
  assert.match(html, /Wardrobe Pass/);
  assert.match(html, /15 minutes/);
  assert.match(html, /£45/);
  assert.match(html, /£80/);
  assert.match(html, /Birmingham, UK/);
  assert.match(html, /amber-card\.png/);
  assert.match(html, /amber-style\.jpg/);
  assert.match(html, /Show availability/);
});
