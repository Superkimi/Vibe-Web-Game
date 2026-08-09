import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/ai-3d/route";
import { defaultProject3D } from "../lib/3d-default-project";

const config = {
  protocol: "openai" as const,
  providerName: "Test provider",
  baseUrl: "https://models.example.com/v1",
  model: "test-model",
  apiKey: "test-secret",
  temperature: 0.2,
};

test("the 3D AI route validates PlayCanvas operations", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.headers && (init.headers as Record<string, string>).authorization, "Bearer test-secret");
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        summary: "Warm up the hero",
        explanation: "Changes the hero crystal material without changing the scene graph.",
        operations: [{
          op: "updateEntity",
          sceneId: "scene-garden",
          entityId: "hero-crystal",
          patch: { render: { material: { color: "#ff9f6e" } } },
        }],
        testPlan: ["Press Play and inspect the hero crystal."],
      }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const response = await POST(new Request("http://localhost/api/ai-3d", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project: defaultProject3D, message: "Warm the hero material", config }),
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.changes.operations[0].op, "updateEntity");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the 3D AI route blocks private model endpoints", async () => {
  const response = await POST(new Request("http://localhost/api/ai-3d", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project: defaultProject3D, message: "Change the scene", config: { ...config, baseUrl: "https://127.0.0.1/v1" } }),
  }));
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.ok, false);
  assert.match(body.error, /Private network/);
});
