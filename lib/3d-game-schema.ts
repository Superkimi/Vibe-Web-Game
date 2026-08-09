import { z } from "zod";

/**
 * The 3D editor intentionally has its own contract.  It mirrors the pieces
 * PlayCanvas needs (entities, transforms and components) without making the
 * Phaser 2D schema carry fields it cannot interpret.
 */
export const color3DSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color");

export const vector3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

export const transform3DSchema = z.object({
  position: vector3Schema,
  rotation: vector3Schema,
  scale: vector3Schema.extend({
    x: z.number().positive().max(100),
    y: z.number().positive().max(100),
    z: z.number().positive().max(100),
  }),
});

export const material3DSchema = z.object({
  color: color3DSchema.default("#8c7cf0"),
  metallic: z.number().min(0).max(1).default(0),
  roughness: z.number().min(0).max(1).default(0.62),
  opacity: z.number().min(0).max(1).default(1),
  emissive: color3DSchema.default("#000000"),
});

export const renderComponent3DSchema = z.object({
  primitive: z.enum(["box", "sphere", "capsule", "cone", "cylinder", "plane", "torus"]),
  material: material3DSchema,
  castShadows: z.boolean().default(true),
  receiveShadows: z.boolean().default(true),
});

export const cameraComponent3DSchema = z.object({
  fov: z.number().min(10).max(120).default(45),
  nearClip: z.number().positive().max(100).default(0.1),
  farClip: z.number().positive().max(100000).default(1000),
});

export const lightComponent3DSchema = z.object({
  kind: z.enum(["directional", "omni", "spot"]),
  color: color3DSchema.default("#fff4dd"),
  intensity: z.number().min(0).max(20).default(1),
  range: z.number().positive().max(1000).default(20),
});

const spinBehavior3DSchema = z.object({
  id: z.string().min(1),
  type: z.literal("spin"),
  speed: z.number().min(-720).max(720).default(35),
  axis: z.enum(["x", "y", "z"]).default("y"),
});

const bobBehavior3DSchema = z.object({
  id: z.string().min(1),
  type: z.literal("bob"),
  amplitude: z.number().min(0).max(20).default(0.25),
  speed: z.number().min(0.1).max(20).default(1.4),
});

export const behavior3DSchema = z.discriminatedUnion("type", [
  spinBehavior3DSchema,
  bobBehavior3DSchema,
]);

export const entity3DSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  parentId: z.string().min(1).nullable().default(null),
  kind: z.enum(["empty", "mesh", "camera", "light"]),
  enabled: z.boolean().default(true),
  transform: transform3DSchema,
  render: renderComponent3DSchema.optional(),
  camera: cameraComponent3DSchema.optional(),
  light: lightComponent3DSchema.optional(),
  behaviors: z.array(behavior3DSchema).max(12).default([]),
  tags: z.array(z.string().max(40)).max(16).default([]),
});

export const asset3DSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  type: z.enum(["model", "texture", "audio"]),
  source: z.string().min(1),
  mimeType: z.string().max(120).default(""),
  altText: z.string().max(240).default(""),
});

export const scene3DSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  backgroundColor: color3DSchema,
  environment: z.object({
    ambientColor: color3DSchema.default("#9aa4c8"),
    exposure: z.number().min(0).max(5).default(1),
  }),
  entities: z.array(entity3DSchema).max(500),
});

export const gameProject3DSchema = z.object({
  schemaVersion: z.literal("3d-1.0.0"),
  dimension: z.literal("3d"),
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
    clearColor: color3DSchema,
    gridSize: z.number().positive().max(100).default(1),
    shadows: z.boolean().default(true),
    autoRotatePreview: z.boolean().default(false),
  }),
  assets: z.array(asset3DSchema).max(200),
  scenes: z.array(scene3DSchema).min(1).max(50),
  activeSceneId: z.string().min(1),
});

const addEntityOperation3DSchema = z.object({
  op: z.literal("addEntity"),
  sceneId: z.string(),
  entity: entity3DSchema,
});

const updateEntityOperation3DSchema = z.object({
  op: z.literal("updateEntity"),
  sceneId: z.string(),
  entityId: z.string(),
  patch: z.object({
    name: z.string().min(1).max(80).optional(),
    parentId: z.string().min(1).nullable().optional(),
    enabled: z.boolean().optional(),
    transform: z.object({
      position: vector3Schema.partial().optional(),
      rotation: vector3Schema.partial().optional(),
      scale: vector3Schema.partial().optional(),
    }).partial().optional(),
    render: z.object({
      primitive: renderComponent3DSchema.shape.primitive.optional(),
      material: material3DSchema.partial().optional(),
      castShadows: z.boolean().optional(),
      receiveShadows: z.boolean().optional(),
    }).partial().optional(),
    camera: cameraComponent3DSchema.partial().optional(),
    light: lightComponent3DSchema.partial().optional(),
    tags: z.array(z.string().max(40)).max(16).optional(),
  }),
});

const deleteEntityOperation3DSchema = z.object({
  op: z.literal("deleteEntity"),
  sceneId: z.string(),
  entityId: z.string(),
});

const duplicateEntityOperation3DSchema = z.object({
  op: z.literal("duplicateEntity"),
  sceneId: z.string(),
  entityId: z.string(),
  newEntityId: z.string(),
  name: z.string().min(1).max(80).optional(),
  offset: vector3Schema.partial().default({ x: 0.5, y: 0, z: 0.5 }),
});

const updateSettingsOperation3DSchema = z.object({
  op: z.literal("updateSettings"),
  patch: gameProject3DSchema.shape.settings.partial(),
});

const updateSceneOperation3DSchema = z.object({
  op: z.literal("updateScene"),
  sceneId: z.string(),
  patch: z.object({
    name: z.string().min(1).max(80).optional(),
    backgroundColor: color3DSchema.optional(),
    environment: scene3DSchema.shape.environment.partial().optional(),
  }),
});

const updateProjectMetaOperation3DSchema = z.object({
  op: z.literal("updateProjectMeta"),
  patch: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
  }),
});

export const gameOperation3DSchema = z.discriminatedUnion("op", [
  addEntityOperation3DSchema,
  updateEntityOperation3DSchema,
  deleteEntityOperation3DSchema,
  duplicateEntityOperation3DSchema,
  updateSettingsOperation3DSchema,
  updateSceneOperation3DSchema,
  updateProjectMetaOperation3DSchema,
]);

export const aiChangeSet3DSchema = z.object({
  summary: z.string().min(1).max(300),
  explanation: z.string().min(1).max(1200),
  operations: z.array(gameOperation3DSchema).min(1).max(30),
  testPlan: z.array(z.string().min(1).max(200)).min(1).max(8),
});

export type GameProject3D = z.infer<typeof gameProject3DSchema>;
export type GameScene3D = z.infer<typeof scene3DSchema>;
export type GameEntity3D = z.infer<typeof entity3DSchema>;
export type GameBehavior3D = z.infer<typeof behavior3DSchema>;
export type GameOperation3D = z.infer<typeof gameOperation3DSchema>;
export type AIChangeSet3D = z.infer<typeof aiChangeSet3DSchema>;
