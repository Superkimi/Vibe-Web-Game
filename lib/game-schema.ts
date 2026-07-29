import { z } from "zod";

export const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color");

export const transformSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  rotation: z.number().finite().default(0),
  scaleX: z.number().positive().max(20).default(1),
  scaleY: z.number().positive().max(20).default(1),
});

export const appearanceSchema = z.object({
  width: z.number().positive().max(4096).default(64),
  height: z.number().positive().max(4096).default(64),
  color: colorSchema.default("#7c6ee6"),
  opacity: z.number().min(0).max(1).default(1),
  text: z.string().max(500).optional(),
  fontSize: z.number().int().min(8).max(240).optional(),
  assetId: z.string().optional(),
});

export const physicsSchema = z.object({
  enabled: z.boolean().default(false),
  static: z.boolean().default(false),
  collideWorldBounds: z.boolean().default(false),
  allowGravity: z.boolean().default(true),
  bounce: z.number().min(0).max(1).default(0),
});

const playerControllerBehaviorSchema = z.object({
  id: z.string().min(1),
  type: z.literal("playerController"),
  speed: z.number().min(20).max(1200).default(260),
  jumpVelocity: z.number().min(50).max(1600).default(520),
});

const patrolBehaviorSchema = z.object({
  id: z.string().min(1),
  type: z.literal("patrol"),
  speed: z.number().min(10).max(800).default(100),
  distance: z.number().min(20).max(2000).default(180),
});

const collectibleBehaviorSchema = z.object({
  id: z.string().min(1),
  type: z.literal("collectible"),
  points: z.number().int().min(1).max(100000).default(10),
});

const cameraFollowBehaviorSchema = z.object({
  id: z.string().min(1),
  type: z.literal("cameraFollow"),
  lerp: z.number().min(0.01).max(1).default(0.12),
});

const bounceBehaviorSchema = z.object({
  id: z.string().min(1),
  type: z.literal("bounce"),
  velocityX: z.number().min(-1500).max(1500).default(160),
  velocityY: z.number().min(-1500).max(1500).default(-220),
});

export const behaviorSchema = z.discriminatedUnion("type", [
  playerControllerBehaviorSchema,
  patrolBehaviorSchema,
  collectibleBehaviorSchema,
  cameraFollowBehaviorSchema,
  bounceBehaviorSchema,
]);

export const entitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  type: z.enum(["rectangle", "ellipse", "text", "sprite"]),
  enabled: z.boolean().default(true),
  transform: transformSchema,
  appearance: appearanceSchema,
  physics: physicsSchema,
  behaviors: z.array(behaviorSchema).max(12).default([]),
  tags: z.array(z.string().max(40)).max(16).default([]),
});

export const assetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  type: z.enum(["image", "audio"]),
  source: z.string().min(1),
  altText: z.string().max(240).default(""),
});

export const sceneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  backgroundColor: colorSchema,
  entities: z.array(entitySchema).max(500),
});

export const gameProjectSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  meta: z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(100),
    description: z.string().max(500).default(""),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  settings: z.object({
    width: z.number().int().min(320).max(3840),
    height: z.number().int().min(240).max(2160),
    backgroundColor: colorSchema,
    gravityY: z.number().min(-3000).max(3000),
    pixelArt: z.boolean(),
    scaleMode: z.enum(["fit", "responsive"]),
  }),
  assets: z.array(assetSchema).max(200),
  scenes: z.array(sceneSchema).min(1).max(50),
  activeSceneId: z.string().min(1),
});

const addEntityOperationSchema = z.object({
  op: z.literal("addEntity"),
  sceneId: z.string(),
  entity: entitySchema,
});

const updateEntityOperationSchema = z.object({
  op: z.literal("updateEntity"),
  sceneId: z.string(),
  entityId: z.string(),
  patch: z.object({
    name: z.string().min(1).max(80).optional(),
    enabled: z.boolean().optional(),
    transform: transformSchema.partial().optional(),
    appearance: appearanceSchema.partial().optional(),
    physics: physicsSchema.partial().optional(),
    tags: z.array(z.string().max(40)).max(16).optional(),
  }),
});

const deleteEntityOperationSchema = z.object({
  op: z.literal("deleteEntity"),
  sceneId: z.string(),
  entityId: z.string(),
});

const duplicateEntityOperationSchema = z.object({
  op: z.literal("duplicateEntity"),
  sceneId: z.string(),
  entityId: z.string(),
  newEntityId: z.string(),
  name: z.string().min(1).max(80).optional(),
  offsetX: z.number().min(-2000).max(2000).default(24),
  offsetY: z.number().min(-2000).max(2000).default(24),
});

const addBehaviorOperationSchema = z.object({
  op: z.literal("addBehavior"),
  sceneId: z.string(),
  entityId: z.string(),
  behavior: behaviorSchema,
});

const removeBehaviorOperationSchema = z.object({
  op: z.literal("removeBehavior"),
  sceneId: z.string(),
  entityId: z.string(),
  behaviorId: z.string(),
});

const updateSettingsOperationSchema = z.object({
  op: z.literal("updateSettings"),
  patch: gameProjectSchema.shape.settings.partial(),
});

const updateSceneOperationSchema = z.object({
  op: z.literal("updateScene"),
  sceneId: z.string(),
  patch: z.object({
    name: z.string().min(1).max(80).optional(),
    backgroundColor: colorSchema.optional(),
  }),
});

const updateProjectMetaOperationSchema = z.object({
  op: z.literal("updateProjectMeta"),
  patch: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
  }),
});

export const gameOperationSchema = z.discriminatedUnion("op", [
  addEntityOperationSchema,
  updateEntityOperationSchema,
  deleteEntityOperationSchema,
  duplicateEntityOperationSchema,
  addBehaviorOperationSchema,
  removeBehaviorOperationSchema,
  updateSettingsOperationSchema,
  updateSceneOperationSchema,
  updateProjectMetaOperationSchema,
]);

export const aiChangeSetSchema = z.object({
  summary: z.string().min(1).max(300),
  explanation: z.string().min(1).max(1200),
  operations: z.array(gameOperationSchema).min(1).max(30),
  testPlan: z.array(z.string().min(1).max(200)).min(1).max(8),
});

export type GameProject = z.infer<typeof gameProjectSchema>;
export type GameScene = z.infer<typeof sceneSchema>;
export type GameEntity = z.infer<typeof entitySchema>;
export type GameBehavior = z.infer<typeof behaviorSchema>;
export type GameOperation = z.infer<typeof gameOperationSchema>;
export type AIChangeSet = z.infer<typeof aiChangeSetSchema>;

