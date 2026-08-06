"use client";

import { useEffect, useRef, useState } from "react";
import type { GameEntity3D, GameProject3D } from "@/lib/3d-game-schema";

type PlayCanvasCanvasProps = {
  project: GameProject3D;
  isPlaying: boolean;
  isPaused: boolean;
  onLog: (message: string, level?: "info" | "success" | "warning" | "error") => void;
};

type RuntimeEntity = import("playcanvas").Entity;
type RuntimeApplication = import("playcanvas").Application;

type RuntimeNode = {
  entity: RuntimeEntity;
  kind: GameEntity3D["kind"];
  primitive?: GameEntity3D["render"] extends infer Render
    ? Render extends { primitive: infer Primitive }
      ? Primitive
      : never
    : never;
  bobBaseY: number;
};

type RuntimeState = {
  pc: typeof import("playcanvas");
  app: RuntimeApplication;
  editorCamera: RuntimeEntity;
  nodes: Map<string, RuntimeNode>;
  time: number;
  resizeObserver?: ResizeObserver;
  sync: (project: GameProject3D) => void;
};

function colorToEngine(pc: typeof import("playcanvas"), value: string) {
  const hex = value.replace("#", "");
  return new pc.Color(
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  );
}

function applyTransform(runtimeEntity: RuntimeEntity, entity: GameEntity3D) {
  runtimeEntity.setPosition(
    entity.transform.position.x,
    entity.transform.position.y,
    entity.transform.position.z,
  );
  runtimeEntity.setLocalEulerAngles(
    entity.transform.rotation.x,
    entity.transform.rotation.y,
    entity.transform.rotation.z,
  );
  runtimeEntity.setLocalScale(
    entity.transform.scale.x,
    entity.transform.scale.y,
    entity.transform.scale.z,
  );
}

function updateMaterial(pc: typeof import("playcanvas"), runtimeEntity: RuntimeEntity, entity: GameEntity3D) {
  if (!runtimeEntity.render || !entity.render) return;
  const material = new pc.StandardMaterial();
  material.diffuse = colorToEngine(pc, entity.render.material.color);
  material.emissive = colorToEngine(pc, entity.render.material.emissive);
  material.emissiveIntensity = entity.render.material.emissive === "#000000" ? 0 : 0.8;
  material.metalness = entity.render.material.metallic;
  material.gloss = 1 - entity.render.material.roughness;
  material.opacity = entity.render.material.opacity;
  if (entity.render.material.opacity < 1) {
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
  }
  material.update();
  for (const meshInstance of runtimeEntity.render.meshInstances ?? []) {
    meshInstance.material = material;
    meshInstance.castShadow = entity.render.castShadows;
    meshInstance.receiveShadow = entity.render.receiveShadows;
  }
}

function createRuntimeEntity(
  pc: typeof import("playcanvas"),
  app: RuntimeApplication,
  entity: GameEntity3D,
): RuntimeNode {
  const runtimeEntity = new pc.Entity(entity.name, app);
  if (entity.kind === "mesh" && entity.render) {
    runtimeEntity.addComponent("render", {
      type: entity.render.primitive,
      castShadows: entity.render.castShadows,
      receiveShadows: entity.render.receiveShadows,
    });
    updateMaterial(pc, runtimeEntity, entity);
  }
  if (entity.kind === "camera" && entity.camera) {
    runtimeEntity.addComponent("camera", {
      fov: entity.camera.fov,
      nearClip: entity.camera.nearClip,
      farClip: entity.camera.farClip,
      priority: 0,
    });
  }
  if (entity.kind === "light" && entity.light) {
    runtimeEntity.addComponent("light", {
      type: entity.light.kind,
      color: colorToEngine(pc, entity.light.color),
      intensity: entity.light.intensity,
      range: entity.light.range,
      castShadows: true,
    });
  }
  return {
    entity: runtimeEntity,
    kind: entity.kind,
    primitive: entity.render?.primitive,
    bobBaseY: entity.transform.position.y,
  };
}

export function PlayCanvasCanvas({
  project,
  isPlaying,
  isPaused,
  onLog,
}: PlayCanvasCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<RuntimeState | null>(null);
  const projectRef = useRef(project);
  const playingRef = useRef(isPlaying);
  const pausedRef = useRef(isPaused);
  const callbacksRef = useRef({ onLog });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    projectRef.current = project;
    runtimeRef.current?.sync(project);
  }, [project]);

  useEffect(() => {
    playingRef.current = isPlaying;
    pausedRef.current = isPaused;
  }, [isPaused, isPlaying]);

  useEffect(() => {
    callbacksRef.current = { onLog };
  }, [onLog]);

  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;

    const mount = async () => {
      try {
        const pc = await import("playcanvas");
        if (disposed || !host) return;

        const canvas = document.createElement("canvas");
        canvas.setAttribute("aria-label", "PlayCanvas 3D viewport");
        canvas.dataset.testid = "playcanvas-viewport";
        host.appendChild(canvas);

        const app = new pc.Application(canvas, {
          graphicsDeviceOptions: {
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          },
        });
        app.scene.ambientLight = colorToEngine(pc, projectRef.current.scenes[0].environment.ambientColor);
        app.scene.exposure = projectRef.current.scenes[0].environment.exposure;

        const editorCamera = new pc.Entity("Editor Camera", app);
        editorCamera.addComponent("camera", {
          fov: 45,
          nearClip: 0.1,
          farClip: 1000,
          clearColor: colorToEngine(pc, projectRef.current.settings.clearColor),
          priority: 100,
        });
        editorCamera.setPosition(0, 4.5, 9);
        editorCamera.lookAt(0, 0, 0);
        app.root.addChild(editorCamera);

        const runtime: RuntimeState = {
          pc,
          app,
          editorCamera,
          nodes: new Map(),
          time: 0,
          sync: () => undefined,
        };

        runtime.sync = (nextProject) => {
          const scene = nextProject.scenes.find((item) => item.id === nextProject.activeSceneId) ?? nextProject.scenes[0];
          const sceneEntities = scene.entities;
          const desiredIds = new Set(sceneEntities.map((entity) => entity.id));

          for (const [id, node] of runtime.nodes) {
            if (!desiredIds.has(id)) {
              node.entity.destroy();
              runtime.nodes.delete(id);
            }
          }

          for (const entity of sceneEntities) {
            const current = runtime.nodes.get(entity.id);
            const requiresRebuild =
              !current ||
              current.kind !== entity.kind ||
              current.primitive !== entity.render?.primitive;
            const node = requiresRebuild
              ? (() => {
                  current?.entity.destroy();
                  const next = createRuntimeEntity(pc, app, entity);
                  runtime.nodes.set(entity.id, next);
                  return next;
                })()
              : current;
            if (!node) continue;

            node.entity.name = entity.name;
            node.entity.enabled = entity.enabled;
            applyTransform(node.entity, entity);
            node.bobBaseY = entity.transform.position.y;
            if (!requiresRebuild) {
              updateMaterial(pc, node.entity, entity);
              if (entity.kind === "light" && entity.light && node.entity.light) {
                node.entity.light.color = colorToEngine(pc, entity.light.color);
                node.entity.light.intensity = entity.light.intensity;
                node.entity.light.range = entity.light.range;
                node.entity.light.type = entity.light.kind;
              }
            }
          }

          for (const entity of sceneEntities) {
            const node = runtime.nodes.get(entity.id);
            if (!node) continue;
            const parent = entity.parentId ? runtime.nodes.get(entity.parentId)?.entity : app.root;
            if (parent && node.entity.parent !== parent) parent.addChild(node.entity);
          }

          app.scene.ambientLight = colorToEngine(pc, scene.environment.ambientColor);
          app.scene.exposure = scene.environment.exposure;
          if (editorCamera.camera) {
            editorCamera.camera.clearColor = colorToEngine(pc, nextProject.settings.clearColor);
          }
          app.resizeCanvas(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
        };

        runtimeRef.current = runtime;
        runtime.sync(projectRef.current);

        app.on("update", (deltaTime: number) => {
          runtime.time += deltaTime;
          const scene = projectRef.current.scenes.find((item) => item.id === projectRef.current.activeSceneId) ?? projectRef.current.scenes[0];
          const animate = playingRef.current || projectRef.current.settings.autoRotatePreview;
          if (!animate || pausedRef.current) return;
          for (const entity of scene.entities) {
            const node = runtime.nodes.get(entity.id);
            if (!node?.entity.enabled) continue;
            for (const behavior of entity.behaviors) {
              if (behavior.type === "spin") {
                const rotation = node.entity.getLocalEulerAngles();
                const amount = behavior.speed * deltaTime;
                if (behavior.axis === "x") rotation.x += amount;
                if (behavior.axis === "y") rotation.y += amount;
                if (behavior.axis === "z") rotation.z += amount;
                node.entity.setLocalEulerAngles(rotation.x, rotation.y, rotation.z);
              }
              if (behavior.type === "bob") {
                node.entity.setPosition(
                  entity.transform.position.x,
                  node.bobBaseY + Math.sin(runtime.time * behavior.speed) * behavior.amplitude,
                  entity.transform.position.z,
                );
              }
            }
          }
        });

        const resizeObserver = new ResizeObserver(() => {
          app.resizeCanvas(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
        });
        resizeObserver.observe(host);
        app.start();
        callbacksRef.current.onLog("PlayCanvas 3D runtime ready", "success");

        runtime.resizeObserver = resizeObserver;
      } catch (mountError) {
        const message = mountError instanceof Error ? mountError.message : String(mountError);
        setError(message);
        callbacksRef.current.onLog(`PlayCanvas runtime failed: ${message}`, "error");
      }
    };

    void mount();
    return () => {
      disposed = true;
      const runtime = runtimeRef.current;
      runtime?.resizeObserver?.disconnect();
      runtime?.app?.destroy();
      runtimeRef.current = null;
      host.replaceChildren();
    };
  }, []);

  return (
    <div className="studio3d-canvas-host" ref={hostRef}>
      {error && (
        <div className="studio3d-canvas-error" role="alert">
          <strong>PlayCanvas unavailable</strong>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
