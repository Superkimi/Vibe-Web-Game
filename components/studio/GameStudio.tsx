"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  BracketsCurly,
  Bug,
  CaretDown,
  ChatCircleDots,
  Check,
  Circle,
  Code,
  Copy,
  DownloadSimple,
  FloppyDisk,
  FolderOpen,
  Gear,
  GridFour,
  ImageSquare,
  MagicWand,
  Pause,
  Play,
  Plus,
  Robot,
  Selection,
  SlidersHorizontal,
  Sparkle,
  Square,
  Stop,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { GameCanvas } from "./GameCanvas";
import {
  defaultModelConfig,
  loadModelConfig,
  ModelSettings,
  type ModelConfig,
} from "./ModelSettings";
import {
  aiChangeSetSchema,
  gameProjectSchema,
  type AIChangeSet,
  type GameBehavior,
  type GameEntity,
  type GameOperation,
} from "@/lib/game-schema";
import { applyOperations, summarizeOperation } from "@/lib/project-operations";
import { loadPersistedProject, useStudioStore } from "@/lib/studio-store";
import { withBasePath } from "@/lib/base-path";
import { useI18n } from "@/lib/i18n";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type ConsoleEntry = {
  id: string;
  message: string;
  level: "info" | "success" | "warning" | "error";
  timestamp: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const quickPrompts = [
  "Add a moving platform above the player.",
  "Make the level feel more playful with a brighter palette.",
  "Add two collectibles on the right side and explain the change.",
];

function entityIcon(entity: GameEntity) {
  if (entity.type === "ellipse") return <Circle size={14} />;
  if (entity.type === "text") return <Code size={14} />;
  if (entity.type === "sprite") return <ImageSquare size={14} />;
  return <Square size={14} />;
}

function Field({
  label,
  value,
  type = "number",
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: string | number;
  type?: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
  onCommit: (value: string | number) => void;
}) {
  const commit = (draft: string) => {
    if (type === "number") {
      const numeric = Number(draft);
      if (Number.isFinite(numeric)) onCommit(numeric);
    } else {
      onCommit(draft);
    }
  };
  return (
    <label className="inspector-field">
      <span>{label}</span>
      <input
        type={type}
        key={`${label}-${value}`}
        defaultValue={String(value)}
        min={min}
        max={max}
        step={step}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function GameStudio() {
  const { language, setLanguage, t } = useI18n();
  const {
    project,
    selectedEntityId,
    isPlaying,
    isPaused,
    history,
    future,
    setSelectedEntityId,
    setPlaying,
    setPaused,
    commit,
    undo,
    redo,
    reset,
    hydrate,
  } = useStudioStore();

  const [rightTab, setRightTab] = useState<"inspector" | "ai">("ai");
  const [leftTab, setLeftTab] = useState<"scene" | "assets">("scene");
  const [bottomTab, setBottomTab] = useState<"console" | "schema" | "history">("console");
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [modelConfig, setModelConfig] = useState<ModelConfig>(defaultModelConfig);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Describe a playable change. I will propose validated operations, show the diff, and wait for approval before touching the scene.",
    },
  ]);
  const [pendingChange, setPendingChange] = useState<AIChangeSet | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [schemaDraft, setSchemaDraft] = useState(() => JSON.stringify(project, null, 2));
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const importRef = useRef<HTMLInputElement>(null);
  const assetRef = useRef<HTMLInputElement>(null);

  const activeScene =
    project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0];
  const selectedEntity =
    activeScene.entities.find((entity) => entity.id === selectedEntityId) ?? null;

  const addLog = useCallback(
    (message: string, level: ConsoleEntry["level"] = "info") => {
      setConsoleEntries((entries) =>
        [
          ...entries,
          {
            id: crypto.randomUUID(),
            message,
            level,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
        ].slice(-80),
      );
    },
    [],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const persisted = loadPersistedProject();
      if (persisted) hydrate(persisted);
      setModelConfig(loadModelConfig());
    });
    return () => cancelAnimationFrame(frame);
  }, [hydrate]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSchemaDraft(JSON.stringify(project, null, 2));
    });
    return () => cancelAnimationFrame(frame);
  }, [project]);

  const commitOperations = useCallback(
    (operations: GameOperation[], label: string) => {
      try {
        const next = applyOperations(project, operations);
        commit(next, label);
        addLog(label, "success");
      } catch (error) {
        addLog(error instanceof Error ? error.message : String(error), "error");
      }
    },
    [addLog, commit, project],
  );

  const updateEntity = useCallback(
    (patch: Extract<GameOperation, { op: "updateEntity" }>["patch"], label = t("Edit entity")) => {
      if (!selectedEntity) return;
      commitOperations(
        [
          {
            op: "updateEntity",
            sceneId: activeScene.id,
            entityId: selectedEntity.id,
            patch,
          },
        ],
        label,
      );
    },
    [activeScene.id, commitOperations, selectedEntity, t],
  );

  const addEntity = (
    type: GameEntity["type"] = "rectangle",
    assetId?: string,
    name = t("New object"),
  ) => {
    const id = `entity-${crypto.randomUUID().slice(0, 8)}`;
    const entity: GameEntity = {
      id,
      name,
      type,
      enabled: true,
      transform: {
        x: Math.round(project.settings.width / 2),
        y: Math.round(project.settings.height / 2),
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      appearance: {
        width: 72,
        height: 72,
        color: "#8a7cf0",
        opacity: 1,
        ...(assetId ? { assetId } : {}),
        ...(type === "text" ? { text: t("New text"), fontSize: 24 } : {}),
      },
      physics: {
        enabled: false,
        static: false,
        collideWorldBounds: false,
        allowGravity: true,
        bounce: 0,
      },
      behaviors: [],
      tags: [],
    };
    commitOperations([{ op: "addEntity", sceneId: activeScene.id, entity }], t("Add object"));
    setSelectedEntityId(id);
    setRightTab("inspector");
  };

  const importAsset = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      addLog(t("Only image assets are supported in this release."), "warning");
      return;
    }
    if (file.size > 1_500_000) {
      addLog(t("Keep image assets under 1.5 MB so local project saves stay reliable."), "warning");
      return;
    }
    const source = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error(t("Could not read image")));
      reader.readAsDataURL(file);
    });
    const assetId = `asset-${crypto.randomUUID().slice(0, 8)}`;
    const next = structuredClone(project);
    next.assets.push({
      id: assetId,
      name: file.name,
      type: "image",
      source,
      altText: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
    });
    next.meta.updatedAt = new Date().toISOString();
    commit(next, t("Import asset {name}", { name: file.name }));
    addLog(t("Imported {name}. Click it to place a sprite.", { name: file.name }), "success");
  };

  const duplicateSelected = () => {
    if (!selectedEntity) return;
    const newEntityId = `${selectedEntity.id}-${crypto.randomUUID().slice(0, 5)}`;
    commitOperations(
      [
        {
          op: "duplicateEntity",
          sceneId: activeScene.id,
          entityId: selectedEntity.id,
          newEntityId,
          name: `${selectedEntity.name} copy`,
          offsetX: 24,
          offsetY: 24,
        },
      ],
      t("Duplicate {name}", { name: selectedEntity.name }),
    );
    setSelectedEntityId(newEntityId);
  };

  const deleteSelected = () => {
    if (!selectedEntity) return;
    commitOperations(
      [{ op: "deleteEntity", sceneId: activeScene.id, entityId: selectedEntity.id }],
      t("Delete {name}", { name: selectedEntity.name }),
    );
    setSelectedEntityId(null);
  };

  const addBehavior = (type: GameBehavior["type"]) => {
    if (!selectedEntity) return;
    let behavior: GameBehavior;
    const id = `behavior-${type}-${crypto.randomUUID().slice(0, 6)}`;
    if (type === "playerController") {
      behavior = { id, type, speed: 260, jumpVelocity: 520 };
    } else if (type === "patrol") {
      behavior = { id, type, speed: 100, distance: 180 };
    } else if (type === "collectible") {
      behavior = { id, type, points: 100 };
    } else if (type === "cameraFollow") {
      behavior = { id, type, lerp: 0.12 };
    } else {
      behavior = { id, type: "bounce", velocityX: 160, velocityY: -220 };
    }
    commitOperations(
      [
        {
          op: "addBehavior",
          sceneId: activeScene.id,
          entityId: selectedEntity.id,
          behavior,
        },
      ],
      t("Add {type}", { type: t(type) }),
    );
  };

  const moveEntityFromCanvas = useCallback(
    (entityId: string, x: number, y: number) => {
      commitOperations(
        [
          {
            op: "updateEntity",
            sceneId: activeScene.id,
            entityId,
            patch: { transform: { x, y } },
          },
        ],
        t("Move object on canvas"),
      );
    },
    [activeScene.id, commitOperations, t],
  );

  const applySchemaDraft = () => {
    try {
      const parsed = gameProjectSchema.parse(JSON.parse(schemaDraft));
      commit(parsed, t("Apply schema edit"));
      addLog(t("Schema edit validated and applied."), "success");
    } catch (error) {
      addLog(error instanceof Error ? error.message : String(error), "error");
    }
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${project.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.vibe-game.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    addLog(t("Project exported."), "success");
  };

  const importProject = async (file: File) => {
    try {
      const parsed = gameProjectSchema.parse(JSON.parse(await file.text()));
      commit(parsed, t("Imported {name}.", { name: file.name }));
      setSelectedEntityId(null);
      addLog(t("Imported {name}.", { name: file.name }), "success");
    } catch (error) {
      addLog(error instanceof Error ? error.message : String(error), "error");
    }
  };

  const sendPrompt = async () => {
    const message = chatInput.trim();
    if (!message || aiLoading) return;
    setChatInput("");
    setPendingChange(null);
    setChatMessages((items) => [
      ...items,
      { id: crypto.randomUUID(), role: "user", content: message },
    ]);

    if (!modelConfig.apiKey) {
      setChatMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: t(
            "Connect a model first. Your API key stays on this device and is only forwarded for this request.",
          ),
        },
      ]);
      setModelSettingsOpen(true);
      return;
    }

    setAiLoading(true);
    try {
      const response = await fetch(withBasePath("/api/ai"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project, message, config: modelConfig }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || t("AI request failed"));
      const changes = aiChangeSetSchema.parse(payload.changes);
      setPendingChange(changes);
      setChatMessages((items) => [
        ...items,
        { id: crypto.randomUUID(), role: "assistant", content: changes.explanation },
      ]);
      addLog(t("AI proposed {count} validated operations.", { count: changes.operations.length }), "info");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      setChatMessages((items) => [
        ...items,
        { id: crypto.randomUUID(), role: "assistant", content: messageText },
      ]);
      addLog(messageText, "error");
    } finally {
      setAiLoading(false);
    }
  };

  const projectStats = useMemo(
    () => ({
      entities: activeScene.entities.length,
      behaviors: activeScene.entities.reduce((sum, entity) => sum + entity.behaviors.length, 0),
    }),
    [activeScene],
  );

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Selection size={18} weight="bold" /></div>
          <div>
            <strong>Vibe Web Game</strong>
          <span>{t("Phaser Studio")}</span>
          </div>
        </div>

        <div className="project-title">
          <span>{project.meta.name}</span>
          <small>{t("Saved locally")}</small>
        </div>

        <nav className="toolbar-cluster" aria-label={t("Project actions")}>
          <button type="button" onClick={undo} disabled={!history.length} aria-label={t("Undo")}>
            <ArrowCounterClockwise size={17} />
          </button>
          <button type="button" onClick={redo} disabled={!future.length} aria-label={t("Redo")}>
            <ArrowClockwise size={17} />
          </button>
          <span className="toolbar-divider" />
          <button type="button" onClick={() => importRef.current?.click()}>
            <UploadSimple size={16} /> {t("Import")}
          </button>
          <button type="button" onClick={exportProject}>
            <DownloadSimple size={16} /> {t("Export")}
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,.vibe-game.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importProject(file);
              event.currentTarget.value = "";
            }}
          />
          <button type="button" onClick={() => setModelSettingsOpen(true)}>
            <Gear size={16} /> {t("Model")}
          </button>
          <button
            className="language-button"
            type="button"
            onClick={() => setLanguage(language === "en" ? "zh" : "en")}
            aria-label={t("Switch language")}
          >
            {language === "en" ? "中文" : "EN"}
          </button>
        </nav>
      </header>

      <section className="studio-workspace">
        <Group orientation="horizontal">
          <Panel defaultSize="18%" minSize="14%" maxSize="28%" className="workspace-panel">
            <aside className="scene-panel">
              <div className="panel-tabs">
                <button className={leftTab === "scene" ? "active" : ""} type="button" onClick={() => setLeftTab("scene")}><FolderOpen size={15} /> {t("Scene")}</button>
                <button className={leftTab === "assets" ? "active" : ""} type="button" onClick={() => setLeftTab("assets")}><ImageSquare size={15} /> {t("Assets")} <span>{project.assets.length}</span></button>
              </div>
              <div className="scene-heading">
                <button type="button">
                  {leftTab === "scene" ? <CaretDown size={13} /> : <ImageSquare size={13} />}
                  {leftTab === "scene" && <GridFour size={14} />}
                  {leftTab === "scene" ? activeScene.name : t("Project assets")}
                </button>
                {leftTab === "scene" ? (
                  <button className="icon-button" type="button" onClick={() => addEntity()} aria-label={t("Add object")}>
                    <Plus size={15} />
                  </button>
                ) : (
                  <button className="icon-button" type="button" onClick={() => assetRef.current?.click()} aria-label={t("Import image")}>
                    <UploadSimple size={15} />
                  </button>
                )}
              </div>
              {leftTab === "scene" ? (
                <div className="entity-tree" role="tree" aria-label={t("Scene entities")}>
                  {activeScene.entities.map((entity) => (
                    <button
                      type="button"
                      role="treeitem"
                      aria-selected={selectedEntityId === entity.id}
                      className={selectedEntityId === entity.id ? "selected" : ""}
                      key={entity.id}
                      onClick={() => {
                        setSelectedEntityId(entity.id);
                        setRightTab("inspector");
                      }}
                    >
                      {entityIcon(entity)}
                      <span>{entity.name}</span>
                      {!entity.enabled && <small>{t("off")}</small>}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="asset-browser">
                  <input
                    ref={assetRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importAsset(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  {!project.assets.length ? (
                    <button className="asset-drop" type="button" onClick={() => assetRef.current?.click()}>
                      <UploadSimple size={22} />
                      <strong>{t("Import an image")}</strong>
                      <span>{t("PNG, JPEG, WebP or GIF · max 1.5 MB")}</span>
                    </button>
                  ) : (
                    project.assets.map((asset) => (
                      <button
                        className="asset-item"
                        type="button"
                        key={asset.id}
                        onClick={() => {
                          if (asset.type === "image") {
                            addEntity("sprite", asset.id, asset.name.replace(/\.[^.]+$/, ""));
                            setLeftTab("scene");
                          }
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- imported data URLs stay local and cannot use an image optimizer */}
                        {asset.type === "image" ? <img src={asset.source} alt={asset.altText} /> : <ImageSquare size={22} />}
                        <span>{asset.name}</span>
                        <small>{t("Place sprite")}</small>
                      </button>
                    ))
                  )}
                </div>
              )}
              <footer className="scene-stats">
                {leftTab === "scene" ? (
                  <>
                    <span>{t("{count} objects", { count: projectStats.entities })}</span>
                    <span>{t("{count} behaviors", { count: projectStats.behaviors })}</span>
                  </>
                ) : (
                  <>
                    <span>{t("{count} assets", { count: project.assets.length })}</span>
                    <span>{t("Local project")}</span>
                  </>
                )}
              </footer>
            </aside>
          </Panel>
          <Separator className="resize-handle vertical" />

          <Panel defaultSize="57%" minSize="36%" className="workspace-panel">
            <Group orientation="vertical">
              <Panel defaultSize="73%" minSize="42%" className="workspace-panel">
                <section className="viewport-panel">
                  <header className="viewport-toolbar">
                    <div className="mode-switcher">
                      <button className={!isPlaying ? "active" : ""} type="button" onClick={() => setPlaying(false)}>
                        <Selection size={15} /> {t("Edit")}
                      </button>
                      <button className={isPlaying ? "active" : ""} type="button" onClick={() => setPlaying(true)}>
                        <Play size={15} weight="fill" /> {t("Play")}
                      </button>
                    </div>
                    <div className="play-controls">
                      <button
                        className={isPlaying ? "run-button active" : "run-button"}
                        type="button"
                        onClick={() => setPlaying(!isPlaying)}
                        aria-label={isPlaying ? t("Stop game") : t("Run game")}
                      >
                        {isPlaying ? <Stop size={15} weight="fill" /> : <Play size={15} weight="fill" />}
                      </button>
                      <button
                        type="button"
                        disabled={!isPlaying}
                        onClick={() => setPaused(!isPaused)}
                        aria-label={isPaused ? t("Resume game") : t("Pause game")}
                      >
                        {isPaused ? <Play size={15} /> : <Pause size={15} />}
                      </button>
                    </div>
                    <div className="viewport-meta">
                      <span>{project.settings.width} × {project.settings.height}</span>
                      <span>100%</span>
                    </div>
                  </header>
                  <div className="viewport-stage" onClick={() => !isPlaying && setSelectedEntityId(null)}>
                    <div className="canvas-frame" onClick={(event) => event.stopPropagation()}>
                      <GameCanvas
                        project={project}
                        isPlaying={isPlaying}
                        isPaused={isPaused}
                        selectedEntityId={selectedEntityId}
                        onSelectEntity={setSelectedEntityId}
                        onMoveEntity={moveEntityFromCanvas}
                        onLog={addLog}
                      />
                    </div>
                    <div className="viewport-hint">
                      {isPlaying ? t("Arrow keys or WASD to move. Space to jump.") : t("Drag objects on canvas. Edit precise values in Inspector.")}
                    </div>
                  </div>
                </section>
              </Panel>
              <Separator className="resize-handle horizontal" />
              <Panel defaultSize="27%" minSize="16%" maxSize="52%" className="workspace-panel">
                <section className="bottom-panel">
                  <header>
                    <div className="panel-tabs compact">
                      <button className={bottomTab === "console" ? "active" : ""} onClick={() => setBottomTab("console")} type="button">
                        <Bug size={14} /> {t("Output")}
                        {consoleEntries.length > 0 && <span>{consoleEntries.length}</span>}
                      </button>
                      <button className={bottomTab === "schema" ? "active" : ""} onClick={() => setBottomTab("schema")} type="button">
                        <BracketsCurly size={14} /> {t("Schema")}
                      </button>
                      <button className={bottomTab === "history" ? "active" : ""} onClick={() => setBottomTab("history")} type="button">
                        <FloppyDisk size={14} /> {t("History")}
                      </button>
                    </div>
                    {bottomTab === "schema" && (
                      <button className="apply-schema" type="button" onClick={applySchemaDraft}>
                        <Check size={14} /> {t("Validate & apply")}
                      </button>
                    )}
                    {bottomTab === "console" && (
                      <button className="text-button" type="button" onClick={() => setConsoleEntries([])}>
                        {t("Clear")}
                      </button>
                    )}
                  </header>
                  {bottomTab === "console" && (
                    <div className="console-view" data-testid="console-view">
                      {!consoleEntries.length ? (
                        <div className="empty-console">
                          <Bug size={20} />
                          <span>{t("Run or edit the scene to see validation and runtime messages.")}</span>
                        </div>
                      ) : (
                        consoleEntries.map((entry) => (
                          <div className={`console-row ${entry.level}`} key={entry.id}>
                            <span>{entry.timestamp}</span>
                            <b>{entry.level}</b>
                            <p>{entry.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  {bottomTab === "schema" && (
                    <div className="schema-editor">
                      <MonacoEditor
                        language="json"
                        theme="vs-dark"
                        value={schemaDraft}
                        onChange={(value) => setSchemaDraft(value ?? "")}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 12,
                          lineHeight: 20,
                          tabSize: 2,
                          wordWrap: "on",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    </div>
                  )}
                  {bottomTab === "history" && (
                    <div className="history-view">
                      {!history.length ? (
                        <div className="empty-console">
                          <FloppyDisk size={20} />
                          <span>{t("Every manual or AI change creates a recoverable snapshot.")}</span>
                        </div>
                      ) : (
                        [...history].reverse().map((item) => (
                          <div className="history-row" key={item.id}>
                            <ArrowCounterClockwise size={14} />
                            <span>{item.label}</span>
                            <time>{new Date(item.createdAt).toLocaleTimeString()}</time>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </section>
              </Panel>
            </Group>
          </Panel>
          <Separator className="resize-handle vertical" />

          <Panel defaultSize="25%" minSize="20%" maxSize="38%" className="workspace-panel">
            <aside className="right-panel">
              <div className="panel-tabs">
                <button className={rightTab === "inspector" ? "active" : ""} type="button" onClick={() => setRightTab("inspector")}>
                  <SlidersHorizontal size={15} /> {t("Inspector")}
                </button>
                <button className={rightTab === "ai" ? "active" : ""} type="button" onClick={() => setRightTab("ai")}>
                  <Sparkle size={15} weight="fill" /> {t("Vibe")}
                </button>
              </div>

              {rightTab === "inspector" ? (
                <div className="inspector-scroll">
                  {!selectedEntity ? (
                    <>
                      <section className="entity-summary project-summary">
                        <div className="entity-icon"><GridFour size={15} /></div>
                        <div>
                          <strong>{project.meta.name}</strong>
                          <span>{t("Project settings")}</span>
                        </div>
                      </section>
                      <section className="inspector-section">
                        <header><CaretDown size={13} /><h3>{t("Game")}</h3></header>
                        <Field label={t("Name")} type="text" value={project.meta.name} onCommit={(name) => commitOperations([{ op: "updateProjectMeta", patch: { name: String(name) } }], t("Rename project"))} />
                        <Field label={t("Description")} type="text" value={project.meta.description} onCommit={(description) => commitOperations([{ op: "updateProjectMeta", patch: { description: String(description) } }], t("Edit project description"))} />
                      </section>
                      <section className="inspector-section">
                        <header><CaretDown size={13} /><h3>{t("Viewport")}</h3></header>
                        <div className="field-grid">
                          <Field label={t("Width")} value={project.settings.width} min={320} max={3840} onCommit={(width) => commitOperations([{ op: "updateSettings", patch: { width: Number(width) } }], t("Change viewport width"))} />
                          <Field label={t("Height")} value={project.settings.height} min={240} max={2160} onCommit={(height) => commitOperations([{ op: "updateSettings", patch: { height: Number(height) } }], t("Change viewport height"))} />
                        </div>
                        <Field label={t("Gravity Y")} value={project.settings.gravityY} min={-3000} max={3000} onCommit={(gravityY) => commitOperations([{ op: "updateSettings", patch: { gravityY: Number(gravityY) } }], t("Change gravity"))} />
                        <Toggle label={t("Pixel art rendering")} checked={project.settings.pixelArt} onChange={(pixelArt) => commitOperations([{ op: "updateSettings", patch: { pixelArt } }], t("Toggle pixel art"))} />
                      </section>
                      <section className="inspector-section">
                        <header><CaretDown size={13} /><h3>{t("Scene")}</h3></header>
                        <Field label={t("Name")} type="text" value={activeScene.name} onCommit={(name) => commitOperations([{ op: "updateScene", sceneId: activeScene.id, patch: { name: String(name) } }], t("Rename scene"))} />
                        <label className="color-field">
                          <span>{t("Background")}</span>
                          <input type="color" value={activeScene.backgroundColor} onChange={(event) => commitOperations([{ op: "updateScene", sceneId: activeScene.id, patch: { backgroundColor: event.target.value } }], t("Change scene background"))} />
                          <code>{activeScene.backgroundColor}</code>
                        </label>
                      </section>
                    </>
                  ) : (
                    <>
                      <section className="entity-summary">
                        <div className="entity-icon">{entityIcon(selectedEntity)}</div>
                        <div>
                          <strong>{selectedEntity.name}</strong>
                          <span>{t(selectedEntity.type)} · {selectedEntity.id}</span>
                        </div>
                        <Toggle
                          label=""
                          checked={selectedEntity.enabled}
                          onChange={(enabled) => updateEntity({ enabled }, t("Toggle object"))}
                        />
                      </section>
                      <section className="inspector-section">
                        <header><CaretDown size={13} /><h3>{t("Identity")}</h3></header>
                        <Field label={t("Name")} type="text" value={selectedEntity.name} onCommit={(name) => updateEntity({ name: String(name) }, t("Rename object"))} />
                        <label className="inspector-field">
                          <span>{t("Type")}</span>
                          <select value={selectedEntity.type} disabled>
                            <option>{selectedEntity.type}</option>
                          </select>
                        </label>
                      </section>
                      <section className="inspector-section">
                        <header><CaretDown size={13} /><h3>{t("Transform")}</h3></header>
                        <div className="field-grid">
                          <Field label="X" value={selectedEntity.transform.x} onCommit={(x) => updateEntity({ transform: { x: Number(x) } }, t("Change X"))} />
                          <Field label="Y" value={selectedEntity.transform.y} onCommit={(y) => updateEntity({ transform: { y: Number(y) } }, t("Change Y"))} />
                          <Field label={t("Rotation")} value={selectedEntity.transform.rotation} step={0.1} onCommit={(rotation) => updateEntity({ transform: { rotation: Number(rotation) } }, t("Rotate object"))} />
                          <Field label={t("Scale X")} value={selectedEntity.transform.scaleX} step={0.1} onCommit={(scaleX) => updateEntity({ transform: { scaleX: Number(scaleX) } }, t("Scale object"))} />
                          <Field label={t("Scale Y")} value={selectedEntity.transform.scaleY} step={0.1} onCommit={(scaleY) => updateEntity({ transform: { scaleY: Number(scaleY) } }, t("Scale object"))} />
                        </div>
                      </section>
                      <section className="inspector-section">
                        <header><CaretDown size={13} /><h3>{t("Appearance")}</h3></header>
                        <div className="field-grid">
                          <Field label={t("Width")} value={selectedEntity.appearance.width} min={1} onCommit={(width) => updateEntity({ appearance: { width: Number(width) } }, t("Resize object"))} />
                          <Field label={t("Height")} value={selectedEntity.appearance.height} min={1} onCommit={(height) => updateEntity({ appearance: { height: Number(height) } }, t("Resize object"))} />
                        </div>
                        <label className="color-field">
                          <span>{t("Color")}</span>
                          <input
                            type="color"
                            value={selectedEntity.appearance.color}
                            onChange={(event) => updateEntity({ appearance: { color: event.target.value } }, t("Change color"))}
                          />
                          <code>{selectedEntity.appearance.color}</code>
                        </label>
                        <Field label={t("Opacity")} value={selectedEntity.appearance.opacity} min={0} max={1} step={0.05} onCommit={(opacity) => updateEntity({ appearance: { opacity: Number(opacity) } }, t("Change opacity"))} />
                        {selectedEntity.type === "text" && (
                          <Field label={t("Text")} type="text" value={selectedEntity.appearance.text ?? ""} onCommit={(text) => updateEntity({ appearance: { text: String(text) } }, t("Edit text"))} />
                        )}
                      </section>
                      <section className="inspector-section">
                        <header><CaretDown size={13} /><h3>{t("Physics")}</h3></header>
                        <Toggle label={t("Enabled")} checked={selectedEntity.physics.enabled} onChange={(enabled) => updateEntity({ physics: { enabled } }, t("Toggle physics"))} />
                        <Toggle label={t("Static body")} checked={selectedEntity.physics.static} onChange={(staticBody) => updateEntity({ physics: { static: staticBody } }, t("Change body type"))} />
                        <Toggle label={t("World bounds")} checked={selectedEntity.physics.collideWorldBounds} onChange={(collideWorldBounds) => updateEntity({ physics: { collideWorldBounds } }, t("Change bounds"))} />
                        <Field label={t("Bounce")} value={selectedEntity.physics.bounce} min={0} max={1} step={0.05} onCommit={(bounce) => updateEntity({ physics: { bounce: Number(bounce) } }, t("Change bounce"))} />
                      </section>
                      <section className="inspector-section behaviors-section">
                        <header><CaretDown size={13} /><h3>{t("Behaviors")}</h3><span>{selectedEntity.behaviors.length}</span></header>
                        {selectedEntity.behaviors.map((behavior) => (
                          <div className="behavior-row" key={behavior.id}>
                            <MagicWand size={14} />
                            <span>{t(behavior.type)}</span>
                            <button
                              type="button"
                              aria-label={t("Remove {type}", { type: t(behavior.type) })}
                              onClick={() =>
                                commitOperations(
                                  [
                                    {
                                      op: "removeBehavior",
                                      sceneId: activeScene.id,
                                      entityId: selectedEntity.id,
                                      behaviorId: behavior.id,
                                    },
                                  ],
                                  t("Remove {type}", { type: t(behavior.type) }),
                                )
                              }
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                        <div className="behavior-buttons">
                          {(["playerController", "patrol", "collectible", "cameraFollow"] as const).map((type) => (
                            <button type="button" key={type} onClick={() => addBehavior(type)}>
                              <Plus size={12} /> {t(type)}
                            </button>
                          ))}
                        </div>
                      </section>
                      <div className="inspector-actions">
                        <button type="button" onClick={duplicateSelected}><Copy size={15} /> {t("Duplicate")}</button>
                        <button className="danger" type="button" onClick={deleteSelected}><Trash size={15} /> {t("Delete")}</button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="ai-panel">
                  <header className="ai-context">
                    <div>
                      <Robot size={19} />
                      <span>
                        <strong>{modelConfig.model}</strong>
                        <small>{t(modelConfig.providerName)}</small>
                      </span>
                    </div>
                    <button className="icon-button" type="button" onClick={() => setModelSettingsOpen(true)} aria-label={t("Configure model")}>
                      <Gear size={16} />
                    </button>
                  </header>

                  <div className="chat-scroll">
                    {chatMessages.map((message) => (
                      <article className={`chat-message ${message.role}`} key={message.id}>
                        <div>{message.role === "assistant" ? <Sparkle size={14} weight="fill" /> : t("You")}</div>
                        <p>
                          {message.id === "welcome"
                            ? t(
                                "Describe a playable change. I will propose validated operations, show the diff, and wait for approval before touching the scene.",
                              )
                            : message.content}
                        </p>
                      </article>
                    ))}
                    {aiLoading && (
                      <article className="chat-message assistant loading-message">
                        <div><Sparkle size={14} weight="fill" /></div>
                        <p><span />{t("Validating a playable change set…")}</p>
                      </article>
                    )}
                    {pendingChange && (
                      <section className="change-set" data-testid="change-set">
                        <header>
                          <span>{t("PROPOSED CHANGE")}</span>
                          <strong>{pendingChange.summary}</strong>
                        </header>
                        <div className="operation-list">
                          {pendingChange.operations.map((operation, index) => (
                            <div key={`${operation.op}-${index}`}>
                              <Check size={13} />
                              <span>{summarizeOperation(operation)}</span>
                            </div>
                          ))}
                        </div>
                        <details>
                          <summary>{t("Verification plan")}</summary>
                          <ul>
                            {pendingChange.testPlan.map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </details>
                        <footer>
                          <button type="button" onClick={() => setPendingChange(null)}>{t("Reject")}</button>
                          <button
                            className="apply-change"
                            type="button"
                            onClick={() => {
                              commitOperations(pendingChange.operations, t("AI: {summary}", { summary: pendingChange.summary }));
                              setChatMessages((items) => [
                                ...items,
                                { id: crypto.randomUUID(), role: "assistant", content: t("Applied. The scene and schema are now in sync.") },
                              ]);
                              setPendingChange(null);
                            }}
                          >
                            <MagicWand size={14} /> {t("Apply change")}
                          </button>
                        </footer>
                      </section>
                    )}
                  </div>

                  {!chatMessages.some((message) => message.role === "user") && (
                    <div className="quick-prompts">
                      {quickPrompts.map((prompt) => (
                        <button type="button" key={prompt} onClick={() => setChatInput(prompt)}>
                          {t(prompt)}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="chat-composer">
                    <textarea
                      value={chatInput}
                      placeholder={t("Describe the game change you want…")}
                      rows={3}
                      onChange={(event) => setChatInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          sendPrompt();
                        }
                      }}
                    />
                    <footer>
                      <span><ChatCircleDots size={13} /> {t("Schema-safe edit")}</span>
                      <button type="button" onClick={sendPrompt} disabled={!chatInput.trim() || aiLoading}>
                        <MagicWand size={14} /> {t("Build")}
                      </button>
                    </footer>
                  </div>
                </div>
              )}
            </aside>
          </Panel>
        </Group>
      </section>

      <footer className="studio-statusbar">
        <span><span className="status-indicator" /> Phaser 4.2.1</span>
        <span>Schema v{project.schemaVersion}</span>
        <span>{t("{count} objects", { count: activeScene.entities.length })}</span>
        <span className="status-spacer" />
        <button type="button" onClick={() => { reset(); addLog(t("Project reset to the starter scene."), "warning"); }}>
          {t("Reset starter")}
        </button>
        <span>{t("Local-first")}</span>
      </footer>

      <ModelSettings
        key={`${modelSettingsOpen}-${modelConfig.protocol}-${modelConfig.model}`}
        open={modelSettingsOpen}
        value={modelConfig}
        onClose={() => setModelSettingsOpen(false)}
        onSave={setModelConfig}
      />
    </main>
  );
}
