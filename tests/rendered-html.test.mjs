import assert from "node:assert/strict";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("dist/server/index.js", templateRoot);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
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

test("server-renders the finished product landing page", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Vibe Web Game \| Build Phaser games with AI<\/title>/i);
  assert.match(html, /Build the game\./);
  assert.match(html, /Start building/);
  assert.match(html, /AI changes you can trust/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("server-renders the studio route and its accessible workspace", async () => {
  const response = await render("/studio");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Studio \| Vibe Web Game/);
  assert.doesNotMatch(html, /Studio \| Vibe Web Game \| Vibe Web Game/);
  assert.match(html, /Phaser Studio/);
  assert.match(html, /Scene entities/);
  assert.match(html, /Schema-safe edit/);
});

test("server-renders the isolated PlayCanvas 3D studio route", async () => {
  const response = await render("/studio/3d");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /3D Studio \| Vibe Web Game/);
  assert.doesNotMatch(html, /3D Studio \| Vibe Web Game \| Vibe Web Game/);
  assert.match(html, /PlayCanvas 3D Studio/);
  assert.match(html, /Scene entities/);
  assert.match(html, /Inspector/);
});
