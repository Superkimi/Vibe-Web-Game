import {
  gameProjectSchema,
  type GameEntity,
  type GameOperation,
  type GameProject,
} from "./game-schema";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function findScene(project: GameProject, sceneId: string) {
  const scene = project.scenes.find((item) => item.id === sceneId);
  if (!scene) throw new Error(`Scene "${sceneId}" does not exist`);
  return scene;
}

function findEntity(project: GameProject, sceneId: string, entityId: string) {
  const scene = findScene(project, sceneId);
  const entity = scene.entities.find((item) => item.id === entityId);
  if (!entity) throw new Error(`Entity "${entityId}" does not exist`);
  return { scene, entity };
}

function mergeEntity(entity: GameEntity, patch: Extract<GameOperation, { op: "updateEntity" }>["patch"]) {
  if (patch.name !== undefined) entity.name = patch.name;
  if (patch.enabled !== undefined) entity.enabled = patch.enabled;
  if (patch.transform) Object.assign(entity.transform, patch.transform);
  if (patch.appearance) Object.assign(entity.appearance, patch.appearance);
  if (patch.physics) Object.assign(entity.physics, patch.physics);
  if (patch.tags) entity.tags = patch.tags;
}

export function applyOperations(project: GameProject, operations: GameOperation[]): GameProject {
  const next = clone(project);

  for (const operation of operations) {
    switch (operation.op) {
      case "addEntity": {
        const scene = findScene(next, operation.sceneId);
        if (scene.entities.some((entity) => entity.id === operation.entity.id)) {
          throw new Error(`Entity id "${operation.entity.id}" is already in use`);
        }
        scene.entities.push(operation.entity);
        break;
      }
      case "updateEntity": {
        const { entity } = findEntity(next, operation.sceneId, operation.entityId);
        mergeEntity(entity, operation.patch);
        break;
      }
      case "deleteEntity": {
        const scene = findScene(next, operation.sceneId);
        const index = scene.entities.findIndex((entity) => entity.id === operation.entityId);
        if (index < 0) throw new Error(`Entity "${operation.entityId}" does not exist`);
        scene.entities.splice(index, 1);
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
        duplicate.transform.x += operation.offsetX;
        duplicate.transform.y += operation.offsetY;
        duplicate.behaviors = duplicate.behaviors.map((behavior) => ({
          ...behavior,
          id: `${behavior.id}-${operation.newEntityId}`,
        }));
        scene.entities.push(duplicate);
        break;
      }
      case "addBehavior": {
        const { entity } = findEntity(next, operation.sceneId, operation.entityId);
        if (entity.behaviors.some((behavior) => behavior.id === operation.behavior.id)) {
          throw new Error(`Behavior id "${operation.behavior.id}" is already in use`);
        }
        entity.behaviors.push(operation.behavior);
        break;
      }
      case "removeBehavior": {
        const { entity } = findEntity(next, operation.sceneId, operation.entityId);
        const index = entity.behaviors.findIndex((behavior) => behavior.id === operation.behaviorId);
        if (index < 0) throw new Error(`Behavior "${operation.behaviorId}" does not exist`);
        entity.behaviors.splice(index, 1);
        break;
      }
      case "updateSettings":
        Object.assign(next.settings, operation.patch);
        break;
      case "updateScene": {
        const scene = findScene(next, operation.sceneId);
        Object.assign(scene, operation.patch);
        break;
      }
      case "updateProjectMeta":
        Object.assign(next.meta, operation.patch);
        break;
    }
  }

  next.meta.updatedAt = new Date().toISOString();
  return gameProjectSchema.parse(next);
}

export function summarizeOperation(operation: GameOperation): string {
  switch (operation.op) {
    case "addEntity":
      return `Add ${operation.entity.name}`;
    case "updateEntity":
      return `Update ${operation.entityId}`;
    case "deleteEntity":
      return `Delete ${operation.entityId}`;
    case "duplicateEntity":
      return `Duplicate ${operation.entityId}`;
    case "addBehavior":
      return `Add ${operation.behavior.type} to ${operation.entityId}`;
    case "removeBehavior":
      return `Remove behavior from ${operation.entityId}`;
    case "updateSettings":
      return "Update game settings";
    case "updateScene":
      return `Update scene ${operation.sceneId}`;
    case "updateProjectMeta":
      return "Update project details";
  }
}

