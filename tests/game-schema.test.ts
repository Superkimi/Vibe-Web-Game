import assert from "node:assert/strict";
import test from "node:test";
import { defaultProject } from "../lib/default-project";
import {
  aiChangeSetSchema,
  gameOperationSchema,
  gameProjectSchema,
} from "../lib/game-schema";
import { applyOperations } from "../lib/project-operations";

test("the starter project satisfies the versioned game schema", () => {
  const result = gameProjectSchema.safeParse(defaultProject);
  assert.equal(result.success, true);
  assert.equal(defaultProject.schemaVersion, "1.0.0");
  assert.ok(defaultProject.scenes[0].entities.some((entity) => entity.id === "player"));
});

test("operations update a project immutably and keep it valid", () => {
  const updated = applyOperations(defaultProject, [
    {
      op: "updateEntity",
      sceneId: "scene-main",
      entityId: "player",
      patch: {
        transform: { x: 220, y: 350 },
        appearance: { color: "#735fd3" },
      },
    },
  ]);

  const player = updated.scenes[0].entities.find((entity) => entity.id === "player");
  const originalPlayer = defaultProject.scenes[0].entities.find((entity) => entity.id === "player");
  assert.equal(player?.transform.x, 220);
  assert.equal(player?.appearance.color, "#735fd3");
  assert.equal(originalPlayer?.transform.x, 145);
  assert.equal(gameProjectSchema.safeParse(updated).success, true);
});

test("duplicate operations regenerate behavior ids", () => {
  const updated = applyOperations(defaultProject, [
    {
      op: "duplicateEntity",
      sceneId: "scene-main",
      entityId: "player",
      newEntityId: "player-two",
      name: "Player two",
      offsetX: 40,
      offsetY: 0,
    },
  ]);

  const duplicate = updated.scenes[0].entities.find((entity) => entity.id === "player-two");
  assert.ok(duplicate);
  assert.equal(duplicate?.name, "Player two");
  assert.ok(duplicate?.behaviors.every((behavior) => behavior.id.endsWith("-player-two")));
});

test("unsupported AI operations and malformed colors are rejected", () => {
  assert.equal(
    gameOperationSchema.safeParse({
      op: "runArbitraryCode",
      source: "window.location = 'https://example.com'",
    }).success,
    false,
  );
  assert.equal(
    gameOperationSchema.safeParse({
      op: "updateEntity",
      sceneId: "scene-main",
      entityId: "player",
      patch: { appearance: { color: "purple" } },
    }).success,
    false,
  );
});

test("AI change sets require an explanation and a verification plan", () => {
  const result = aiChangeSetSchema.safeParse({
    summary: "Move the player",
    explanation: "Places the player closer to the first platform.",
    operations: [
      {
        op: "updateEntity",
        sceneId: "scene-main",
        entityId: "player",
        patch: { transform: { x: 180 } },
      },
    ],
    testPlan: ["Run the scene and move with the arrow keys."],
  });
  assert.equal(result.success, true);
});

