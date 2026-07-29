import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { aiChangeSetSchema, gameOperationSchema, gameProjectSchema } from "../lib/game-schema";

const outputPath = resolve("public/schemas/vibe-game.schema.json");

const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://vibe-web-game.pages.dev/schemas/vibe-game.schema.json",
  title: "Vibe Web Game Protocol",
  description:
    "Versioned project and AI operation schemas shared by the editor, Phaser runtime, import/export, and game agent.",
  type: "object",
  properties: {
    project: z.toJSONSchema(gameProjectSchema, { target: "draft-2020-12" }),
    operation: z.toJSONSchema(gameOperationSchema, { target: "draft-2020-12" }),
    aiChangeSet: z.toJSONSchema(aiChangeSetSchema, { target: "draft-2020-12" }),
  },
  required: ["project", "operation", "aiChangeSet"],
  additionalProperties: false,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
console.log(`Generated ${outputPath}`);

