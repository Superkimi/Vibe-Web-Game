# Vibe Web Game

Vibe Web Game is a browser-based Phaser 4 studio that combines direct scene editing with schema-safe AI game creation.

It is designed around one rule: the canvas, inspector, game runtime, project export, and AI agent all operate on the same versioned project document.

## What works

- Phaser 4.2.1 edit and play modes
- Scene hierarchy with object selection
- Direct canvas dragging with grid and physics debug view
- Inspector editing for transforms, appearance, physics, and behaviors
- Local image import with click-to-place sprites
- Project, viewport, gravity, pixel-art, and scene configuration
- Undo, redo, local persistence, JSON import, and JSON export
- Monaco JSON editor with validation before apply
- Configurable OpenAI-compatible and Anthropic model connections
- AI change proposals that require explicit approval
- Zod and published JSON Schema validation
- A playable starter platformer with movement, patrol, collectibles, score, and completion state
- Responsive marketing site and desktop game studio

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open:

- Product page: `http://localhost:3000`
- Game studio: `http://localhost:3000/studio`

## Test

```bash
npm test
```

The test gate validates the project and AI schemas, immutable operations, unsafe operation rejection, AI proxy behavior, the production build, and server-rendered product routes.

## AI model configuration

Open **Model** in the studio toolbar. The UI supports:

- OpenAI-compatible Chat Completions APIs
- Anthropic Messages API
- Provider, base URL, model ID, API key, and temperature

The key is stored in browser local storage and is not added to project exports. The proxy only accepts HTTPS endpoints and blocks loopback and private network addresses.

## Architecture

```text
Browser studio
├── Scene hierarchy and inspector
├── Phaser 4 edit/play runtime
├── Monaco project editor
├── Local project snapshots
└── Vibe conversation
      │
      ▼
Validated AI proxy
├── OpenAI-compatible protocol
├── Anthropic protocol
├── Endpoint safety checks
└── Change-set schema validation
      │
      ▼
Atomic game operations
├── Add/update/delete entity
├── Duplicate entity
├── Add/remove behavior
├── Update scene
└── Update game settings
```

The source schema is in [`lib/game-schema.ts`](lib/game-schema.ts). The generated JSON Schema is published at [`public/schemas/vibe-game.schema.json`](public/schemas/vibe-game.schema.json).

## Product safety model

The AI cannot execute arbitrary code in the game studio. It can only propose a bounded operation type. Every response passes through three checks:

1. Request and project validation.
2. Model response and operation validation.
3. Full project validation after applying the operations.

The user reviews the operation list before applying it, and every applied change creates an undo snapshot.

## Current scope

The first production slice focuses on schema-driven 2D games. Procedural rectangles, ellipses, text, imported image sprites, Arcade Physics, player controls, patrols, camera following, and collectibles are supported.

Image assets up to 1.5 MB can be embedded in local project files. Cloud projects, authentication, audio editing, multiplayer collaboration, and arbitrary user scripting belong in later releases because they require separate storage, isolation, and permission systems.
