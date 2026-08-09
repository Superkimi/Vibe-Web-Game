import assert from "node:assert/strict";
import test from "node:test";
import { defaultProject3D } from "../lib/3d-default-project";
import { gameProject3DSchema } from "../lib/3d-game-schema";
import { applyOperations3D } from "../lib/3d-project-operations";

test("the PlayCanvas project uses an isolated 3D schema", () => {
  const parsed = gameProject3DSchema.parse(defaultProject3D);
  assert.equal(parsed.dimension, "3d");
  assert.equal(parsed.schemaVersion, "3d-1.0.0");
  assert.equal(parsed.scenes[0].entities.find((entity) => entity.id === "hero-crystal")?.render?.primitive, "sphere");
});

test("3D operations update transforms and duplicate entities without touching the 2D contract", () => {
  const sceneId = defaultProject3D.activeSceneId;
  const moved = applyOperations3D(defaultProject3D, [
    {
      op: "updateEntity",
      sceneId,
      entityId: "hero-crystal",
      patch: { transform: { position: { x: -2 } }, render: { material: { roughness: 0.2 } } },
    },
  ]);
  const hero = moved.scenes[0].entities.find((entity) => entity.id === "hero-crystal");
  assert.equal(hero?.transform.position.x, -2);
  assert.equal(hero?.render?.material.roughness, 0.2);

  const duplicateId = "hero-crystal-copy";
  const duplicated = applyOperations3D(moved, [
    {
      op: "duplicateEntity",
      sceneId,
      entityId: "hero-crystal",
      newEntityId: duplicateId,
      offset: { x: 1, z: 1 },
    },
  ]);
  const duplicate = duplicated.scenes[0].entities.find((entity) => entity.id === duplicateId);
  assert.equal(duplicate?.transform.position.x, -1);
  assert.equal(duplicate?.transform.position.z, 1);
});

test("deleting a 3D parent removes its descendants", () => {
  const base = structuredClone(defaultProject3D);
  base.scenes[0].entities.push({
    id: "child-node",
    name: "Child Node",
    parentId: "hero-crystal",
    kind: "empty",
    enabled: true,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    behaviors: [],
    tags: [],
  });
  const next = applyOperations3D(base, [{ op: "deleteEntity", sceneId: base.activeSceneId, entityId: "hero-crystal" }]);
  assert.equal(next.scenes[0].entities.some((entity) => entity.id === "hero-crystal"), false);
  assert.equal(next.scenes[0].entities.some((entity) => entity.id === "child-node"), false);
});
