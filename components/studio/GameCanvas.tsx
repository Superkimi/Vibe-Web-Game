"use client";

import { useEffect, useRef } from "react";
import type { GameEntity, GameProject } from "@/lib/game-schema";

type GameCanvasProps = {
  project: GameProject;
  isPlaying: boolean;
  isPaused: boolean;
  selectedEntityId: string | null;
  onSelectEntity: (id: string | null) => void;
  onMoveEntity: (id: string, x: number, y: number) => void;
  onLog: (message: string, level?: "info" | "success" | "warning") => void;
};

function toNumberColor(color: string) {
  return Number.parseInt(color.slice(1), 16);
}

export function GameCanvas({
  project,
  isPlaying,
  isPaused,
  selectedEntityId,
  onSelectEntity,
  onMoveEntity,
  onLog,
}: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onSelectEntity, onMoveEntity, onLog });

  useEffect(() => {
    callbacksRef.current = { onSelectEntity, onMoveEntity, onLog };
  }, [onLog, onMoveEntity, onSelectEntity]);

  useEffect(() => {
    let disposed = false;
    let game: { destroy: (removeCanvas: boolean, noReturn?: boolean) => void } | null = null;
    const host = hostRef.current;

    async function mount() {
      if (!host) return;
      const Phaser = (await import("phaser")).default;
      if (disposed) return;

      const sceneData =
        project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0];
      const entityObjects = new Map<string, Phaser.GameObjects.GameObject>();
      const entityData = new Map(sceneData.entities.map((entity) => [entity.id, entity]));
      const patrolOrigins = new Map<string, number>();

      class RuntimeScene extends Phaser.Scene {
        selectionGraphics?: Phaser.GameObjects.Graphics;
        score = 0;
        scoreText?: Phaser.GameObjects.Text;
        cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
        wasd?: Record<string, Phaser.Input.Keyboard.Key>;

        preload() {
          for (const asset of project.assets) {
            if (asset.type === "image") this.load.image(asset.id, asset.source);
          }
        }

        create() {
          this.cameras.main.setBackgroundColor(sceneData.backgroundColor);

          if (!isPlaying) {
            const grid = this.add.graphics();
            grid.lineStyle(1, 0xffffff, 0.055);
            for (let x = 0; x <= project.settings.width; x += 32) {
              grid.lineBetween(x, 0, x, project.settings.height);
            }
            for (let y = 0; y <= project.settings.height; y += 32) {
              grid.lineBetween(0, y, project.settings.width, y);
            }
            grid.setDepth(-50);
          }

          for (const entity of sceneData.entities) {
            if (!entity.enabled) continue;
            const object = this.createEntity(entity);
            entityObjects.set(entity.id, object);
            object.setData("entityId", entity.id);

            if (entity.physics.enabled) {
              this.physics.add.existing(object, entity.physics.static);
              const body = (
                object as Phaser.GameObjects.GameObject & {
                  body?: {
                    setAllowGravity?: (value: boolean) => unknown;
                    setCollideWorldBounds?: (value: boolean) => unknown;
                    setBounce?: (value: number) => unknown;
                    updateFromGameObject?: () => unknown;
                  };
                }
              ).body;
              if (body) {
                body.setAllowGravity?.(entity.physics.allowGravity);
                body.setCollideWorldBounds?.(entity.physics.collideWorldBounds);
                body.setBounce?.(entity.physics.bounce);
                body.updateFromGameObject?.();
              }
            }

            if (!isPlaying) this.bindEditorInteraction(object, entity);
          }

          const physicsObjects = [...entityObjects.entries()].filter(([id]) => entityData.get(id)?.physics.enabled);
          const dynamicObjects = physicsObjects.filter(([id]) => !entityData.get(id)?.physics.static);
          const staticObjects = physicsObjects.filter(([id]) => entityData.get(id)?.physics.static);
          for (const [, dynamicObject] of dynamicObjects) {
            for (const [, staticObject] of staticObjects) {
              this.physics.add.collider(dynamicObject, staticObject);
            }
          }

          const playerEntry = [...entityObjects.entries()].find(([id]) =>
            entityData.get(id)?.behaviors.some((behavior) => behavior.type === "playerController"),
          );
          if (playerEntry) {
            const [, playerObject] = playerEntry;
            for (const [id, object] of entityObjects) {
              if (
                entityData
                  .get(id)
                  ?.behaviors.some((behavior) => behavior.type === "collectible")
              ) {
                this.physics.add.overlap(playerObject, object, () => {
                  const collectible = entityData
                    .get(id)
                    ?.behaviors.find((behavior) => behavior.type === "collectible");
                  if (!object.active) return;
                  object.destroy();
                  this.score += collectible?.type === "collectible" ? collectible.points : 0;
                  this.scoreText?.setText(`SCORE  ${this.score}`);
                  callbacksRef.current.onLog(`Collected ${entityData.get(id)?.name ?? id}`, "success");
                  const remaining = [...entityObjects.entries()].filter(
                    ([entityId, candidate]) =>
                      candidate.active &&
                      entityData
                        .get(entityId)
                        ?.behaviors.some((behavior) => behavior.type === "collectible"),
                  );
                  if (remaining.length === 0) {
                    this.add
                      .text(project.settings.width / 2, 145, "LEVEL COMPLETE", {
                        fontFamily: "system-ui, sans-serif",
                        fontSize: "38px",
                        fontStyle: "700",
                        color: "#f4efff",
                        backgroundColor: "#6e5ad1",
                        padding: { x: 22, y: 13 },
                      })
                      .setOrigin(0.5)
                      .setDepth(100);
                    callbacksRef.current.onLog("All collectibles found. Level complete.", "success");
                  }
                });
              }
            }
          }

          this.scoreText = this.add
            .text(project.settings.width - 32, 28, "SCORE  0", {
              fontFamily: "ui-monospace, monospace",
              fontSize: "16px",
              color: "#bdb7d5",
            })
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(90);

          this.cursors = this.input.keyboard?.createCursorKeys();
          this.wasd = this.input.keyboard?.addKeys("W,A,S,D") as Record<
            string,
            Phaser.Input.Keyboard.Key
          >;

          for (const [id, object] of entityObjects) {
            const data = entityData.get(id);
            if (!data) continue;
            const follow = data.behaviors.find((behavior) => behavior.type === "cameraFollow");
            if (follow?.type === "cameraFollow") {
              this.cameras.main.startFollow(
                object as unknown as Phaser.GameObjects.Components.Transform,
                true,
                follow.lerp,
                follow.lerp,
              );
              this.cameras.main.setBounds(0, 0, project.settings.width, project.settings.height);
            }
            if (data.behaviors.some((behavior) => behavior.type === "patrol")) {
              patrolOrigins.set(id, data.transform.x);
            }
          }

          if (!isPlaying) {
            this.physics.world.pause();
            this.drawSelection();
          } else if (isPaused) {
            this.physics.world.pause();
          }

          callbacksRef.current.onLog(
            isPlaying ? `Running ${project.meta.name}` : `Editor scene loaded: ${sceneData.name}`,
            "info",
          );
        }

        createEntity(entity: GameEntity) {
          const { x, y, rotation, scaleX, scaleY } = entity.transform;
          const { width, height, color, opacity } = entity.appearance;
          let object: Phaser.GameObjects.GameObject;

          if (entity.type === "text") {
            object = this.add.text(x, y, entity.appearance.text ?? entity.name, {
              fontFamily: "system-ui, sans-serif",
              fontSize: `${entity.appearance.fontSize ?? 24}px`,
              color,
              fontStyle: "600",
            });
          } else if (
            entity.type === "sprite" &&
            entity.appearance.assetId &&
            this.textures.exists(entity.appearance.assetId)
          ) {
            object = this.add
              .image(x, y, entity.appearance.assetId)
              .setDisplaySize(width, height);
          } else if (entity.type === "ellipse") {
            object = this.add.ellipse(x, y, width, height, toNumberColor(color), opacity);
          } else {
            object = this.add.rectangle(x, y, width, height, toNumberColor(color), opacity);
          }

          const transformable = object as Phaser.GameObjects.GameObject &
            Phaser.GameObjects.Components.Transform &
            Phaser.GameObjects.Components.Alpha;
          transformable.setRotation(rotation);
          transformable.setScale(scaleX, scaleY);
          transformable.setAlpha(opacity);
          return object;
        }

        bindEditorInteraction(object: Phaser.GameObjects.GameObject, entity: GameEntity) {
          const interactive = object as Phaser.GameObjects.GameObject &
            Phaser.GameObjects.Components.Transform & {
              setInteractive: (config?: object) => typeof object;
            };
          interactive.setInteractive({ draggable: true, useHandCursor: true });
          this.input.setDraggable(object);
          object.on("pointerdown", () => {
            callbacksRef.current.onSelectEntity(entity.id);
          });
          object.on("drag", (_pointer: unknown, dragX: number, dragY: number) => {
            interactive.setPosition(
              Math.round(Math.max(0, Math.min(project.settings.width, dragX))),
              Math.round(Math.max(0, Math.min(project.settings.height, dragY))),
            );
            this.drawSelection(object);
          });
          object.on("dragend", () => {
            callbacksRef.current.onMoveEntity(entity.id, Math.round(interactive.x), Math.round(interactive.y));
          });
        }

        drawSelection(explicit?: Phaser.GameObjects.GameObject) {
          this.selectionGraphics?.destroy();
          if (!selectedEntityId) return;
          const object = explicit ?? entityObjects.get(selectedEntityId);
          if (!object?.active) return;
          const bounded = object as Phaser.GameObjects.GameObject & {
            getBounds: () => Phaser.Geom.Rectangle;
          };
          if (!bounded.getBounds) return;
          const bounds = bounded.getBounds();
          this.selectionGraphics = this.add.graphics().setDepth(200);
          this.selectionGraphics.lineStyle(2, 0xa998ff, 1);
          this.selectionGraphics.strokeRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10);
          this.selectionGraphics.fillStyle(0xf2efff, 1);
          for (const [x, y] of [
            [bounds.left - 5, bounds.top - 5],
            [bounds.right + 1, bounds.top - 5],
            [bounds.left - 5, bounds.bottom + 1],
            [bounds.right + 1, bounds.bottom + 1],
          ]) {
            this.selectionGraphics.fillRect(x, y, 6, 6);
          }
        }

        update() {
          if (!isPlaying || isPaused) return;

          for (const [id, object] of entityObjects) {
            if (!object.active) continue;
            const entity = entityData.get(id);
            const body = (
              object as Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.Body }
            ).body;
            if (!entity || !body) continue;

            const controller = entity.behaviors.find(
              (behavior) => behavior.type === "playerController",
            );
            if (controller?.type === "playerController") {
              const left = this.cursors?.left.isDown || this.wasd?.A.isDown;
              const right = this.cursors?.right.isDown || this.wasd?.D.isDown;
              if (left) body.setVelocityX(-controller.speed);
              else if (right) body.setVelocityX(controller.speed);
              else body.setVelocityX(0);

              const jump = this.cursors?.up.isDown || this.cursors?.space.isDown || this.wasd?.W.isDown;
              if (jump && body.blocked.down) body.setVelocityY(-controller.jumpVelocity);
            }

            const patrol = entity.behaviors.find((behavior) => behavior.type === "patrol");
            if (patrol?.type === "patrol") {
              const origin = patrolOrigins.get(id) ?? entity.transform.x;
              const transform = object as unknown as Phaser.GameObjects.Components.Transform;
              if (transform.x >= origin + patrol.distance) body.setVelocityX(-patrol.speed);
              else if (transform.x <= origin - patrol.distance) body.setVelocityX(patrol.speed);
              else if (body.velocity.x === 0) body.setVelocityX(patrol.speed);
            }
          }
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host,
        width: project.settings.width,
        height: project.settings.height,
        backgroundColor: project.settings.backgroundColor,
        pixelArt: project.settings.pixelArt,
        transparent: false,
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: project.settings.gravityY },
            debug: !isPlaying,
          },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: project.settings.width,
          height: project.settings.height,
        },
        scene: RuntimeScene,
      });
    }

    mount();
    return () => {
      disposed = true;
      game?.destroy(true);
      host.replaceChildren();
    };
  }, [isPaused, isPlaying, project, selectedEntityId]);

  return <div ref={hostRef} className="game-canvas-host" data-testid="game-canvas" />;
}
