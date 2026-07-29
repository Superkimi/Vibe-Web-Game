import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/ai/route";
import { defaultProject } from "../lib/default-project";

const config = {
  protocol: "openai" as const,
  providerName: "Test provider",
  baseUrl: "https://models.example.com/v1",
  model: "test-model",
  apiKey: "test-secret",
  temperature: 0.2,
};

test("the AI route validates a model change set before returning it", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.headers && (init.headers as Record<string, string>).authorization, "Bearer test-secret");
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Move the player",
                explanation: "Moves the player closer to the first platform.",
                operations: [
                  {
                    op: "updateEntity",
                    sceneId: "scene-main",
                    entityId: "player",
                    patch: { transform: { x: 190 } },
                  },
                ],
                testPlan: ["Run the scene and move the player."],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const response = await POST(
      new Request("http://localhost/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project: defaultProject,
          message: "Move the player to the right",
          config,
        }),
      }),
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.changes.operations[0].op, "updateEntity");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the AI route blocks private model endpoints before fetch", async () => {
  const response = await POST(
    new Request("http://localhost/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project: defaultProject,
        message: "Change the level",
        config: { ...config, baseUrl: "https://127.0.0.1/v1" },
      }),
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.ok, false);
  assert.match(body.error, /Private network/);
});

test("the AI route rejects unsupported model output", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Unsafe change",
                explanation: "Tries an unsupported operation.",
                operations: [{ op: "executeCode", code: "alert(1)" }],
                testPlan: ["Open the game."],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  try {
    const response = await POST(
      new Request("http://localhost/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project: defaultProject,
          message: "Run arbitrary code",
          config,
        }),
      }),
    );
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.ok, false);
    assert.match(body.error, /Schema validation failed/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

