import {
  gameProject3DSchema,
  type GameEntity3D,
  type GameOperation3D,
  type GameProject3D,
} from "./3d-game-schema";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function findScene(project: GameProject3D, sceneId: string) {
  const scene = project.scenes.find((item) => item.id === sceneId);
  if (!scene) throw new Error(`Scene "${sceneId}" does not exist`);
  return scene;
}

function findEntity(project: GameProject3D, sceneId: string, entityId: string) {
  const scene = findScene(project, sceneId);
  const entity = scene.entities.find((item) => item.id === entityId);
  if (!entity) throw new Error(`Entity "${entityId}" does not exist`);
  return { scene, entity };
}

function mergeEntity(
  entity: GameEntity3D,
  patch: Extract<GameOperation3D, { op: "updateEntity" }>["patch"],
) {
  if (patch.name !== undefined) entity.name = patch.name;
  if (patch.parentId !== undefined) entity.parentId = patch.parentId;
  if (patch.enabled !== undefined) entity.enabled = patch.enabled;
  if (patch.tags !== undefined) entity.tags = patch.tags;

  if (patch.transform) {
    if (patch.transform.position) Object.assign(entity.transform.position, patch.transform.position);
    if (patch.transform.rotation) Object.assign(entity.transform.rotation, patch.transform.rotation);
    if (patch.transform.scale) Object.assign(entity.transform.scale, patch.transform.scale);
  }

  if (patch.render) {
    if (!entity.render) {
      entity.render = {
        primitive: "box",
        material: {
          color: "#8c7cf0",
          metallic: 0,
          roughness: 0.62,
          opacity: 1,
          emissive: "#000000",
        },
        castShadows: true,
        receiveShadows: true,
      };
    }
    if (patch.render.primitive !== undefined) entity.render.primitive = patch.render.primitive;
    if (patch.render.castShadows !== undefined) entity.render.castShadows = patch.render.castShadows;
    if (patch.render.receiveShadows !== undefined) {
      entity.render.receiveShadows = patch.render.receiveShadows;
    }
    if (patch.render.material) Object.assign(entity.render.material, patch.render.material);
    entity.kind = "mesh";
  }

  if (patch.camera) {
    entity.camera = { ...(entity.camera ?? { fov: 45, nearClip: 0.1, farClip: 1000 }), ...patch.camera };
    entity.kind = "camera";
  }

  if (patch.light) {
    entity.light = {
      ...(entity.light ?? { kind: "directional", color: "#fff4dd", intensity: 1, range: 20 }),
      ...patch.light,
    };
    entity.kind = "light";
  }
}

export function applyOperations3D(
  project: GameProject3D,
  operations: GameOperation3D[],
): GameProject3D {
  const next = clone(project);

  for (const operation of operations) {
    switch (operation.op) {
      case "addEntity": {
        const scene = findScene(next, operation.sceneId);
        if (scene.entities.some((entity) => entity.id === operation.entity.id)) {
          throw new Error(`Entity id "${operation.entity.id}" is already in use`);
        }
        if (operation.entity.parentId && !scene.entities.some((entity) => entity.id === operation.entity.parentId)) {
          throw new Error(`Parent entity "${operation.entity.parentId}" does not exist`);
        }
        scene.entities.push(operation.entity);
        break;
      }
      case "updateEntity": {
        const { entity } = findEntity(next, operation.sceneId, operation.entityId);
        if (operation.patch.parentId && operation.patch.parentId === operation.entityId) {
          throw new Error("An entity cannot parent itself");
        }
        if (operation.patch.parentId) findEntity(next, operation.sceneId, operation.patch.parentId);
        mergeEntity(entity, operation.patch);
        break;
      }
      case "deleteEntity": {
        const scene = findScene(next, operation.sceneId);
        const idsToDelete = new Set<string>([operation.entityId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const entity of scene.entities) {
            if (entity.parentId && idsToDelete.has(entity.parentId) && !idsToDelete.has(entity.id)) {
              idsToDelete.add(entity.id);
              changed = true;
            }
          }
        }
        const before = scene.entities.length;
        scene.entities = scene.entities.filter((entity) => !idsToDelete.has(entity.id));
        if (scene.entities.length === before) throw new Error(`Entity "${operation.entityId}" does not exist`);
        break;
      }
      case "duplicateEntity": {
        const { scene, entity } = findEntity(next, operation.sceneId, operation.entityId);
        if (scene.entities.some((item) => item.id === operation.newEntityId)) {
          throw new Error(`Entity id "${operation.newEntityId}" is already in use`);
        }
        const duplicate = clone(entity);
        duplicate.id = operation.newEntityId;
        duplicate.name = operation.name ?? `${entity.name} Copy`;
        duplicate.parentId = entity.parentId;
        const offsetX = operation.offset.x ?? 0.5;
        const offsetY = operation.offset.y ?? 0;
        const offsetZ = operation.offset.z ?? 0.5;
        duplicate.transform.position.x += offsetX;
        duplicate.transform.position.y += offsetY;
        duplicate.transform.position.z += offsetZ;
        duplicate.behaviors = duplicate.behaviors.map((behavior) => ({
          ...behavior,
          id: `${behavior.id}-${operation.newEntityId}`,
        }));
        scene.entities.push(duplicate);
        break;
      }
      case "updateSettings":
        Object.assign(next.settings, operation.patch);
        break;
      case "updateScene": {
        const scene = findScene(next, operation.sceneId);
        if (operation.patch.name !== undefined) scene.name = operation.patch.name;
        if (operation.patch.backgroundColor !== undefined) {
          scene.backgroundColor = operation.patch.backgroundColor;
        }
        if (operation.patch.environment) Object.assign(scene.environment, operation.patch.environment);
        break;
      }
      case "updateProjectMeta":
        Object.assign(next.meta, operation.patch);
        break;
    }
  }

  next.meta.updatedAt = new Date().toISOString();
  return gameProject3DSchema.parse(next);
}

export function summarizeOperation3D(operation: GameOperation3D): string {
  switch (operation.op) {
    case "addEntity":
      return `Add ${operation.entity.name}`;
    case "updateEntity":
      return `Update ${operation.entityId}`;
    case "deleteEntity":
      return `Delete ${operation.entityId}`;
    case "duplicateEntity":
      return `Duplicate ${operation.entityId}`;
    case "updateSettings":
      return "Update 3D settings";
    case "updateScene":
      return `Update scene ${operation.sceneId}`;
    case "updateProjectMeta":
      return "Update project details";
  }
}
