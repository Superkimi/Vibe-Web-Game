"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  BracketsCurly,
  Bug,
  CaretDown,
  ChatCircleDots,
  Check,
  Circle,
  Copy,
  Cube,
  DownloadSimple,
  FloppyDisk,
  FolderOpen,
  Gear,
  Lightbulb,
  MagicWand,
  Pause,
  Play,
  Plus,
  Robot,
  Selection,
  SlidersHorizontal,
  Sparkle,
  Sphere,
  Square,
  Stop,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { ModelSettings, defaultModelConfig, loadModelConfig, type ModelConfig } from "../studio/ModelSettings";
import { PlayCanvasCanvas } from "./PlayCanvasCanvas";
import {
  aiChangeSet3DSchema,
  gameProject3DSchema,
  type GameBehavior3D,
  type GameEntity3D,
  type GameOperation3D,
} from "@/lib/3d-game-schema";
import { defaultProject3D } from "@/lib/3d-default-project";
import { applyOperations3D, summarizeOperation3D } from "@/lib/3d-project-operations";
import { withBasePath } from "@/lib/base-path";
import { useI18n } from "@/lib/i18n";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
const PROJECT_STORAGE_KEY = "vibe-web-game-3d-project-v1";

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

type HistoryEntry = { project: typeof defaultProject3D; label: string };

const quickPrompts = [
  "Add a glowing sphere beside the portal ring.",
  "Make the hero crystal spin slower and use a warmer material.",
  "Duplicate the orbit cube and place it on the left side.",
];

function entityIcon(entity: GameEntity3D) {
  if (entity.kind === "camera") return <Circle size={14} />;
  if (entity.kind === "light") return <Lightbulb size={14} />;
  if (entity.kind === "mesh" && entity.render?.primitive === "sphere") return <Sphere size={14} />;
  if (entity.kind === "mesh") return <Cube size={14} />;
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
  return (
    <label className="studio3d-field">
      <span>{label}</span>
      <input
        type={type}
        key={`${label}-${value}`}
        defaultValue={String(value)}
        min={min}
        max={max}
        step={step}
        onBlur={(event) => {
          const draft = event.currentTarget.value;
          if (type === "number") {
            const numeric = Number(draft);
            if (Number.isFinite(numeric)) onCommit(numeric);
          } else {
            onCommit(draft);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="studio3d-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function GameStudio3D() {
  const { language, setLanguage, t } = useI18n();
  const [project, setProject] = useState(defaultProject3D);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>("hero-crystal");
  const [isPlaying, setPlaying] = useState(false);
  const [isPaused, setPaused] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [rightTab, setRightTab] = useState<"inspector" | "ai">("inspector");
  const [bottomTab, setBottomTab] = useState<"console" | "schema" | "history">("console");
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [modelConfig, setModelConfig] = useState<ModelConfig>(defaultModelConfig);
  const [schemaDraft, setSchemaDraft] = useState(() => JSON.stringify(defaultProject3D, null, 2));
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Describe a 3D change. I will propose validated PlayCanvas operations, show the diff, and wait for approval before touching the scene.",
    },
  ]);
  const [pendingChange, setPendingChange] = useState<ReturnType<typeof aiChangeSet3DSchema.parse> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const activeScene = project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0];
  const selectedEntity = activeScene.entities.find((entity) => entity.id === selectedEntityId) ?? null;

  const addLog = useCallback((message: string, level: ConsoleEntry["level"] = "info") => {
    setConsoleEntries((entries) => [
      ...entries,
      {
        id: crypto.randomUUID(),
        message,
        level,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
    ].slice(-80));
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY);
        if (stored) {
          const parsed = gameProject3DSchema.parse(JSON.parse(stored));
          setProject(parsed);
          setSelectedEntityId(parsed.scenes[0]?.entities.find((entity) => entity.kind === "mesh")?.id ?? null);
        }
      } catch {
        window.localStorage.removeItem(PROJECT_STORAGE_KEY);
      }
      setModelConfig(loadModelConfig());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    const frame = requestAnimationFrame(() => setSchemaDraft(JSON.stringify(project, null, 2)));
    return () => cancelAnimationFrame(frame);
  }, [project]);

  const commit = useCallback((next: typeof defaultProject3D, label: string) => {
    setHistory((entries) => [...entries.slice(-29), { project, label }]);
    setFuture([]);
    setProject(next);
    addLog(label, "success");
  }, [addLog, project]);

  const commitOperations = useCallback((operations: GameOperation3D[], label: string) => {
    try {
      const next = applyOperations3D(project, operations);
      commit(next, label);
    } catch (error) {
      addLog(error instanceof Error ? error.message : String(error), "error");
    }
  }, [addLog, commit, project]);

  const updateEntity = useCallback((patch: Extract<GameOperation3D, { op: "updateEntity" }>["patch"], label = t("Edit entity")) => {
    if (!selectedEntity) return;
    commitOperations([{ op: "updateEntity", sceneId: activeScene.id, entityId: selectedEntity.id, patch }], label);
  }, [activeScene.id, commitOperations, selectedEntity, t]);

  const addEntity = (kind: "mesh" | "camera" | "light", primitive: NonNullable<GameEntity3D["render"]>["primitive"] = "box") => {
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    const entity: GameEntity3D = {
      id,
      name: kind === "mesh" ? `New ${primitive}` : kind === "camera" ? "New Camera" : "New Light",
      parentId: null,
      kind,
      enabled: true,
      transform: {
        position: { x: 0, y: 0.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      ...(kind === "mesh" ? {
        render: {
          primitive,
          material: { color: "#8c7cf0", metallic: 0.15, roughness: 0.5, opacity: 1, emissive: "#000000" },
          castShadows: true,
          receiveShadows: true,
        },
      } : {}),
      ...(kind === "camera" ? { camera: { fov: 45, nearClip: 0.1, farClip: 1000 } } : {}),
      ...(kind === "light" ? { light: { kind: "omni", color: "#fff4dd", intensity: 1, range: 20 } } : {}),
      behaviors: [],
      tags: ["new"],
    };
    commitOperations([{ op: "addEntity", sceneId: activeScene.id, entity }], t("Add {type}", { type: entity.name }));
    setSelectedEntityId(id);
    setRightTab("inspector");
  };

  const duplicateSelected = () => {
    if (!selectedEntity) return;
    const id = `${selectedEntity.id}-${crypto.randomUUID().slice(0, 5)}`;
    commitOperations([
      {
        op: "duplicateEntity",
        sceneId: activeScene.id,
        entityId: selectedEntity.id,
        newEntityId: id,
        name: `${selectedEntity.name} Copy`,
        offset: { x: 0.8, y: 0, z: 0.4 },
      },
    ], t("Duplicate {name}", { name: selectedEntity.name }));
    setSelectedEntityId(id);
  };

  const deleteSelected = () => {
    if (!selectedEntity) return;
    commitOperations([{ op: "deleteEntity", sceneId: activeScene.id, entityId: selectedEntity.id }], t("Delete {name}", { name: selectedEntity.name }));
    setSelectedEntityId(null);
  };

  const addBehavior = (type: GameBehavior3D["type"]) => {
    if (!selectedEntity) return;
    const next = structuredClone(project);
    const target = next.scenes.find((scene) => scene.id === activeScene.id)?.entities.find((entity) => entity.id === selectedEntity.id);
    if (!target) return;
    target.tags = [...new Set([...target.tags, "animated"])]
    if (type === "spin") {
      target.behaviors.push({ id: `behavior-spin-${crypto.randomUUID().slice(0, 6)}`, type: "spin", speed: 35, axis: "y" });
      next.meta.updatedAt = new Date().toISOString();
      commit(next, t("Add spin"));
    } else {
      target.behaviors.push({ id: `behavior-bob-${crypto.randomUUID().slice(0, 6)}`, type: "bob", amplitude: 0.25, speed: 1.4 });
      next.meta.updatedAt = new Date().toISOString();
      commit(next, t("Add bob"));
    }
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((entries) => entries.slice(0, -1));
    setFuture((entries) => [...entries, { project, label: t("Redo") }]);
    setProject(previous.project);
    addLog(`${t("Undo")}: ${previous.label}`, "warning");
  };

  const redo = () => {
    const next = future.at(-1);
    if (!next) return;
    setFuture((entries) => entries.slice(0, -1));
    setHistory((entries) => [...entries, { project, label: t("Undo") }]);
    setProject(next.project);
    addLog(t("Redo"), "success");
  };

  const applySchemaDraft = () => {
    try {
      const parsed = gameProject3DSchema.parse(JSON.parse(schemaDraft));
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
    link.download = `${project.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.vibe-3d.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    addLog(t("Project exported."), "success");
  };

  const importProject = async (file: File) => {
    try {
      const parsed = gameProject3DSchema.parse(JSON.parse(await file.text()));
      commit(parsed, t("Imported {name}.", { name: file.name }));
      setSelectedEntityId(null);
    } catch (error) {
      addLog(error instanceof Error ? error.message : String(error), "error");
    }
  };

  const sendPrompt = async () => {
    const message = chatInput.trim();
    if (!message || aiLoading) return;
    setChatInput("");
    setPendingChange(null);
    setChatMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", content: message }]);
    if (!modelConfig.apiKey) {
      setChatMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: t("Connect a model first. Your API key stays on this device and is only forwarded for this request."),
      }]);
      setModelSettingsOpen(true);
      return;
    }
    setAiLoading(true);
    try {
      const response = await fetch(withBasePath("/api/ai-3d"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project, message, config: modelConfig }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || t("AI request failed"));
      const changes = aiChangeSet3DSchema.parse(payload.changes);
      setPendingChange(changes);
      setChatMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: changes.explanation }]);
      addLog(t("AI proposed {count} validated operations.", { count: changes.operations.length }), "info");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      setChatMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: messageText }]);
      addLog(messageText, "error");
    } finally {
      setAiLoading(false);
    }
  };

  const projectStats = useMemo(() => ({
    entities: activeScene.entities.length,
    meshes: activeScene.entities.filter((entity) => entity.kind === "mesh").length,
  }), [activeScene]);

  return (
    <main className="studio3d-shell">
      <header className="studio3d-topbar">
        <div className="studio3d-brand">
          <div className="studio3d-brand-mark"><Selection size={18} weight="bold" /></div>
          <div>
            <strong>Vibe Web Game</strong>
            <span>{t("PlayCanvas 3D Studio")}</span>
          </div>
        </div>
        <div className="studio3d-title"><span>{project.meta.name}</span><small>{t("Saved locally")}</small></div>
        <nav className="studio3d-actions" aria-label={t("Project actions")}>
          <Link className="studio3d-link-button" href={withBasePath("/studio")}><ArrowCounterClockwise size={15} /> 2D</Link>
          <button type="button" onClick={undo} disabled={!history.length} aria-label={t("Undo")}><ArrowCounterClockwise size={16} /></button>
          <button type="button" onClick={redo} disabled={!future.length} aria-label={t("Redo")}><ArrowClockwise size={16} /></button>
          <span className="studio3d-divider" />
          <button type="button" onClick={() => importRef.current?.click()}><UploadSimple size={15} /> {t("Import")}</button>
          <button type="button" onClick={exportProject}><DownloadSimple size={15} /> {t("Export")}</button>
          <input ref={importRef} type="file" accept=".json,.vibe-3d.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProject(file); event.currentTarget.value = ""; }} />
          <button type="button" onClick={() => setModelSettingsOpen(true)}><Gear size={15} /> {t("Model")}</button>
          <button className="studio3d-language" type="button" onClick={() => setLanguage(language === "en" ? "zh" : "en")} aria-label={t("Switch language")}>{language === "en" ? "中文" : "EN"}</button>
        </nav>
      </header>

      <section className="studio3d-workspace">
        <aside className="studio3d-left-panel">
          <div className="studio3d-panel-tabs"><button className="active" type="button"><FolderOpen size={14} /> {t("Scene")}</button><button type="button"><BracketsCurly size={14} /> 3D</button></div>
          <div className="studio3d-scene-heading"><span><CaretDown size={13} /> {activeScene.name}</span><span className="studio3d-badge">{projectStats.entities}</span></div>
          <div className="studio3d-add-grid">
            <button type="button" onClick={() => addEntity("mesh", "box")}><Plus size={13} /> {t("Box")}</button>
            <button type="button" onClick={() => addEntity("mesh", "sphere")}><Plus size={13} /> {t("Sphere")}</button>
            <button type="button" onClick={() => addEntity("light")}><Plus size={13} /> {t("Light")}</button>
            <button type="button" onClick={() => addEntity("camera")}><Plus size={13} /> {t("Camera")}</button>
          </div>
          <div className="studio3d-entity-tree" role="tree" aria-label={t("Scene entities")}>
            {activeScene.entities.map((entity) => (
              <button type="button" role="treeitem" aria-selected={selectedEntityId === entity.id} className={selectedEntityId === entity.id ? "selected" : ""} key={entity.id} onClick={() => { setSelectedEntityId(entity.id); setRightTab("inspector"); }}>
                {entityIcon(entity)}<span>{entity.name}</span>{!entity.enabled && <small>{t("off")}</small>}
              </button>
            ))}
          </div>
          <footer className="studio3d-left-footer"><span>{t("{count} objects", { count: projectStats.entities })}</span><span>{t("{count} meshes", { count: projectStats.meshes })}</span></footer>
        </aside>

        <section className="studio3d-center">
          <header className="studio3d-viewport-toolbar">
            <div className="studio3d-mode-switcher"><button className={!isPlaying ? "active" : ""} type="button" onClick={() => { setPlaying(false); setPaused(false); }}><Selection size={14} /> {t("Edit")}</button><button className={isPlaying ? "active" : ""} type="button" onClick={() => setPlaying(true)}><Play size={14} weight="fill" /> {t("Play")}</button></div>
            <div className="studio3d-play-controls"><button className={isPlaying ? "active" : ""} type="button" onClick={() => { setPlaying(!isPlaying); setPaused(false); }} aria-label={isPlaying ? t("Stop game") : t("Run game")}>{isPlaying ? <Stop size={15} weight="fill" /> : <Play size={15} weight="fill" />}</button><button type="button" disabled={!isPlaying} onClick={() => setPaused(!isPaused)} aria-label={isPaused ? t("Resume game") : t("Pause game")}>{isPaused ? <Play size={15} /> : <Pause size={15} />}</button></div>
            <div className="studio3d-viewport-meta"><span>{project.settings.width} × {project.settings.height}</span><span>PlayCanvas</span></div>
          </header>
          <div className="studio3d-viewport"><div className="studio3d-canvas-frame"><PlayCanvasCanvas project={project} isPlaying={isPlaying} isPaused={isPaused} onLog={addLog} /></div><div className="studio3d-viewport-hint">{isPlaying ? t("Play mode · spin and bob behaviors are live") : t("Select an entity in the scene tree, then edit transforms and components in Inspector")}</div></div>
          <section className="studio3d-bottom-panel">
            <header><div className="studio3d-panel-tabs compact"><button className={bottomTab === "console" ? "active" : ""} type="button" onClick={() => setBottomTab("console")}><Bug size={13} /> {t("Output")} {consoleEntries.length > 0 && <span>{consoleEntries.length}</span>}</button><button className={bottomTab === "schema" ? "active" : ""} type="button" onClick={() => setBottomTab("schema")}><BracketsCurly size={13} /> {t("Schema")}</button><button className={bottomTab === "history" ? "active" : ""} type="button" onClick={() => setBottomTab("history")}><FloppyDisk size={13} /> {t("History")}</button></div>{bottomTab === "schema" && <button className="studio3d-apply-schema" type="button" onClick={applySchemaDraft}><Check size={13} /> {t("Validate & apply")}</button>}{bottomTab === "console" && <button className="studio3d-clear" type="button" onClick={() => setConsoleEntries([])}>{t("Clear")}</button>}</header>
            {bottomTab === "console" && <div className="studio3d-console">{!consoleEntries.length ? <p>{t("Run or edit the scene to see validation and runtime messages.")}</p> : consoleEntries.map((entry) => <div className={`studio3d-console-row ${entry.level}`} key={entry.id}><span>{entry.timestamp}</span><strong>{entry.level}</strong><p>{entry.message}</p></div>)}</div>}
            {bottomTab === "schema" && <div className="studio3d-schema-editor"><MonacoEditor height="100%" language="json" theme="vs-dark" value={schemaDraft} onChange={(value) => setSchemaDraft(value ?? "")} options={{ minimap: { enabled: false }, fontSize: 11, lineNumbers: "on", padding: { top: 10 } }} /></div>}
            {bottomTab === "history" && <div className="studio3d-history">{!history.length ? <p>{t("Every manual or AI change creates a recoverable snapshot.")}</p> : history.slice().reverse().map((entry, index) => <div key={`${entry.label}-${index}`}><FloppyDisk size={13} /><span>{entry.label}</span></div>)}</div>}
          </section>
        </section>

        <aside className="studio3d-right-panel">
          <div className="studio3d-panel-tabs"><button className={rightTab === "inspector" ? "active" : ""} type="button" onClick={() => setRightTab("inspector")}><SlidersHorizontal size={14} /> {t("Inspector")}</button><button className={rightTab === "ai" ? "active" : ""} type="button" onClick={() => setRightTab("ai")}><Sparkle size={14} weight="fill" /> {t("Vibe")}</button></div>
          {rightTab === "inspector" ? (
            <div className="studio3d-inspector-scroll">
              {!selectedEntity ? <>
                <section className="studio3d-entity-summary"><div className="studio3d-entity-icon"><Cube size={15} /></div><div><strong>{project.meta.name}</strong><span>{t("3D Project")} · {project.schemaVersion}</span></div></section>
                <section className="studio3d-inspector-section"><header><CaretDown size={12} /><h3>{t("Game")}</h3></header><Field label={t("Name")} type="text" value={project.meta.name} onCommit={(name) => commitOperations([{ op: "updateProjectMeta", patch: { name: String(name) } }], t("Rename project"))} /><Field label={t("Description")} type="text" value={project.meta.description} onCommit={(description) => commitOperations([{ op: "updateProjectMeta", patch: { description: String(description) } }], t("Edit project description"))} /></section>
                <section className="studio3d-inspector-section"><header><CaretDown size={12} /><h3>{t("Viewport")}</h3></header><div className="studio3d-field-grid"><Field label={t("Width")} value={project.settings.width} min={320} max={3840} onCommit={(width) => commitOperations([{ op: "updateSettings", patch: { width: Number(width) } }], t("Change viewport width"))} /><Field label={t("Height")} value={project.settings.height} min={240} max={2160} onCommit={(height) => commitOperations([{ op: "updateSettings", patch: { height: Number(height) } }], t("Change viewport height"))} /></div><label className="studio3d-color-field"><span>{t("Background")}</span><input type="color" value={project.settings.clearColor} onChange={(event) => commitOperations([{ op: "updateSettings", patch: { clearColor: event.target.value } }], t("Change scene background"))} /><code>{project.settings.clearColor}</code></label><Field label="Grid" value={project.settings.gridSize} min={0.1} max={20} step={0.1} onCommit={(gridSize) => commitOperations([{ op: "updateSettings", patch: { gridSize: Number(gridSize) } }], t("Change grid size"))} /><Toggle label="Auto rotate preview" checked={project.settings.autoRotatePreview} onChange={(autoRotatePreview) => commitOperations([{ op: "updateSettings", patch: { autoRotatePreview } }], t("Toggle preview animation"))} /></section>
              </> : <>
                <section className="studio3d-entity-summary"><div className="studio3d-entity-icon">{entityIcon(selectedEntity)}</div><div><strong>{selectedEntity.name}</strong><span>{selectedEntity.kind} · {selectedEntity.id}</span></div><Toggle label="" checked={selectedEntity.enabled} onChange={(enabled) => updateEntity({ enabled }, t("Toggle object"))} /></section>
                <section className="studio3d-inspector-section"><header><CaretDown size={12} /><h3>{t("Identity")}</h3></header><Field label={t("Name")} type="text" value={selectedEntity.name} onCommit={(name) => updateEntity({ name: String(name) }, t("Rename object"))} /><Field label="Parent" type="text" value={selectedEntity.parentId ?? "(root)"} onCommit={(parentId) => updateEntity({ parentId: String(parentId) === "(root)" || !String(parentId).trim() ? null : String(parentId) }, t("Change parent"))} /></section>
                <section className="studio3d-inspector-section"><header><CaretDown size={12} /><h3>{t("Transform")}</h3></header><div className="studio3d-inspector-label">{t("Position")}</div><div className="studio3d-field-grid three"><Field label="X" value={selectedEntity.transform.position.x} step={0.1} onCommit={(x) => updateEntity({ transform: { position: { x: Number(x) } } }, t("Change X"))} /><Field label="Y" value={selectedEntity.transform.position.y} step={0.1} onCommit={(y) => updateEntity({ transform: { position: { y: Number(y) } } }, t("Change Y"))} /><Field label="Z" value={selectedEntity.transform.position.z} step={0.1} onCommit={(z) => updateEntity({ transform: { position: { z: Number(z) } } }, t("Change Z"))} /></div><div className="studio3d-inspector-label">{t("Rotation")}</div><div className="studio3d-field-grid three"><Field label="X" value={selectedEntity.transform.rotation.x} step={1} onCommit={(x) => updateEntity({ transform: { rotation: { x: Number(x) } } }, t("Rotate object"))} /><Field label="Y" value={selectedEntity.transform.rotation.y} step={1} onCommit={(y) => updateEntity({ transform: { rotation: { y: Number(y) } } }, t("Rotate object"))} /><Field label="Z" value={selectedEntity.transform.rotation.z} step={1} onCommit={(z) => updateEntity({ transform: { rotation: { z: Number(z) } } }, t("Rotate object"))} /></div><div className="studio3d-inspector-label">{t("Scale")}</div><div className="studio3d-field-grid three"><Field label="X" value={selectedEntity.transform.scale.x} min={0.01} max={100} step={0.1} onCommit={(x) => updateEntity({ transform: { scale: { x: Number(x) } } }, t("Scale object"))} /><Field label="Y" value={selectedEntity.transform.scale.y} min={0.01} max={100} step={0.1} onCommit={(y) => updateEntity({ transform: { scale: { y: Number(y) } } }, t("Scale object"))} /><Field label="Z" value={selectedEntity.transform.scale.z} min={0.01} max={100} step={0.1} onCommit={(z) => updateEntity({ transform: { scale: { z: Number(z) } } }, t("Scale object"))} /></div></section>
                {selectedEntity.render && <section className="studio3d-inspector-section"><header><CaretDown size={12} /><h3>{t("Render component")}</h3></header><label className="studio3d-field"><span>{t("Primitive")}</span><select value={selectedEntity.render.primitive} onChange={(event) => updateEntity({ render: { primitive: event.target.value as NonNullable<GameEntity3D["render"]>["primitive"] } }, t("Change primitive"))}><option value="box">{t("Box")}</option><option value="sphere">{t("Sphere")}</option><option value="capsule">Capsule</option><option value="cone">Cone</option><option value="cylinder">Cylinder</option><option value="plane">Plane</option><option value="torus">Torus</option></select></label><label className="studio3d-color-field"><span>{t("Color")}</span><input type="color" value={selectedEntity.render.material.color} onChange={(event) => updateEntity({ render: { material: { color: event.target.value } } }, t("Change color"))} /><code>{selectedEntity.render.material.color}</code></label><div className="studio3d-field-grid"><Field label={t("Metallic")} value={selectedEntity.render.material.metallic} min={0} max={1} step={0.05} onCommit={(metallic) => updateEntity({ render: { material: { metallic: Number(metallic) } } }, t("Change metallic"))} /><Field label={t("Roughness")} value={selectedEntity.render.material.roughness} min={0} max={1} step={0.05} onCommit={(roughness) => updateEntity({ render: { material: { roughness: Number(roughness) } } }, t("Change roughness"))} /></div><Field label={t("Opacity")} value={selectedEntity.render.material.opacity} min={0} max={1} step={0.05} onCommit={(opacity) => updateEntity({ render: { material: { opacity: Number(opacity) } } }, t("Change opacity"))} /><Toggle label={t("Cast shadows")} checked={selectedEntity.render.castShadows} onChange={(castShadows) => updateEntity({ render: { castShadows } }, t("Toggle shadows"))} /><Toggle label={t("Receive shadows")} checked={selectedEntity.render.receiveShadows} onChange={(receiveShadows) => updateEntity({ render: { receiveShadows } }, t("Toggle shadows"))} /></section>}
                {selectedEntity.camera && <section className="studio3d-inspector-section"><header><CaretDown size={12} /><h3>{t("Camera component")}</h3></header><Field label={t("FOV")} value={selectedEntity.camera.fov} min={10} max={120} onCommit={(fov) => updateEntity({ camera: { fov: Number(fov) } }, t("Change camera FOV"))} /><div className="studio3d-field-grid"><Field label={t("Near")} value={selectedEntity.camera.nearClip} min={0.01} max={100} step={0.1} onCommit={(nearClip) => updateEntity({ camera: { nearClip: Number(nearClip) } }, t("Change camera clip"))} /><Field label={t("Far")} value={selectedEntity.camera.farClip} min={1} max={100000} step={1} onCommit={(farClip) => updateEntity({ camera: { farClip: Number(farClip) } }, t("Change camera clip"))} /></div></section>}
                {selectedEntity.light && <section className="studio3d-inspector-section"><header><CaretDown size={12} /><h3>{t("Light component")}</h3></header><label className="studio3d-field"><span>{t("Kind")}</span><select value={selectedEntity.light.kind} onChange={(event) => updateEntity({ light: { kind: event.target.value as "directional" | "omni" | "spot" } }, t("Change light type"))}><option value="directional">Directional</option><option value="omni">Omni</option><option value="spot">Spot</option></select></label><label className="studio3d-color-field"><span>{t("Color")}</span><input type="color" value={selectedEntity.light.color} onChange={(event) => updateEntity({ light: { color: event.target.value } }, t("Change color"))} /><code>{selectedEntity.light.color}</code></label><Field label={t("Intensity")} value={selectedEntity.light.intensity} min={0} max={20} step={0.1} onCommit={(intensity) => updateEntity({ light: { intensity: Number(intensity) } }, t("Change intensity"))} /><Field label={t("Range")} value={selectedEntity.light.range} min={1} max={1000} step={1} onCommit={(range) => updateEntity({ light: { range: Number(range) } }, t("Change light range"))} /></section>}
                <section className="studio3d-inspector-section"><header><CaretDown size={12} /><h3>{t("Behaviors")}</h3><span>{selectedEntity.behaviors.length}</span></header>{selectedEntity.behaviors.map((behavior) => <div className="studio3d-behavior-row" key={behavior.id}><MagicWand size={13} /><span>{behavior.type}</span><button type="button" onClick={() => { const next = structuredClone(project); const target = next.scenes.find((scene) => scene.id === activeScene.id)?.entities.find((entity) => entity.id === selectedEntity.id); if (target) { target.behaviors = target.behaviors.filter((item) => item.id !== behavior.id); next.meta.updatedAt = new Date().toISOString(); commit(next, t("Remove {type}", { type: behavior.type })); } }} aria-label={t("Remove {type}", { type: behavior.type })}><X size={12} /></button></div>)}<div className="studio3d-behavior-buttons"><button type="button" onClick={() => addBehavior("spin")}><Plus size={11} /> spin</button><button type="button" onClick={() => addBehavior("bob")}><Plus size={11} /> bob</button></div></section>
                <div className="studio3d-inspector-actions"><button type="button" onClick={duplicateSelected}><Copy size={14} /> {t("Duplicate")}</button><button className="danger" type="button" onClick={deleteSelected}><Trash size={14} /> {t("Delete")}</button></div>
              </>}
            </div>
          ) : (
            <div className="studio3d-ai-panel">
              <header className="studio3d-ai-context"><div><Robot size={18} /><span><strong>{modelConfig.model}</strong><small>{modelConfig.providerName}</small></span></div><button type="button" onClick={() => setModelSettingsOpen(true)} aria-label={t("Configure model")}><Gear size={15} /></button></header>
              <div className="studio3d-chat-scroll">{chatMessages.map((message) => <article className={`studio3d-chat-message ${message.role}`} key={message.id}><div>{message.role === "assistant" ? <Sparkle size={13} weight="fill" /> : t("You")}</div><p>{message.id === "welcome" ? t("Describe a 3D change. I will propose validated PlayCanvas operations, show the diff, and wait for approval before touching the scene.") : message.content}</p></article>)}{aiLoading && <article className="studio3d-chat-message assistant loading-message"><div><Sparkle size={13} weight="fill" /></div><p>{t("Validating a playable change set…")}</p></article>}{pendingChange && <section className="studio3d-change-set"><header><span>{t("PROPOSED CHANGE")}</span><strong>{pendingChange.summary}</strong></header><div>{pendingChange.operations.map((operation, index) => <div key={`${operation.op}-${index}`}><Check size={12} /><span>{summarizeOperation3D(operation)}</span></div>)}</div><details><summary>{t("Verification plan")}</summary><ul>{pendingChange.testPlan.map((item) => <li key={item}>{item}</li>)}</ul></details><footer><button type="button" onClick={() => setPendingChange(null)}>{t("Reject")}</button><button className="apply-change" type="button" onClick={() => { commitOperations(pendingChange.operations, t("AI: {summary}", { summary: pendingChange.summary })); setPendingChange(null); setChatMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: t("Applied. The scene and schema are now in sync.") }]); }}><MagicWand size={13} /> {t("Apply change")}</button></footer></section>}</div>
              {!chatMessages.some((message) => message.role === "user") && <div className="studio3d-quick-prompts">{quickPrompts.map((prompt) => <button type="button" key={prompt} onClick={() => setChatInput(prompt)}>{t(prompt)}</button>)}</div>}
              <div className="studio3d-chat-composer"><textarea value={chatInput} rows={3} placeholder={t("Describe the 3D change you want…")} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendPrompt(); } }} /><footer><span><ChatCircleDots size={12} /> {t("3D Schema-safe edit")}</span><button type="button" onClick={() => void sendPrompt()} disabled={!chatInput.trim() || aiLoading}><MagicWand size={13} /> {t("Build")}</button></footer></div>
            </div>
          )}
        </aside>
      </section>

      <footer className="studio3d-statusbar"><span><span className="studio3d-status-dot" /> PlayCanvas 2.17.2</span><span>Schema {project.schemaVersion}</span><span>{t("{count} objects", { count: activeScene.entities.length })}</span><span className="studio3d-status-spacer" /><button type="button" onClick={() => { setProject(defaultProject3D); setSelectedEntityId("hero-crystal"); setHistory([]); setFuture([]); addLog(t("Project reset to the starter scene."), "warning"); }}>{t("Reset starter")}</button><span>{t("Local-first")}</span></footer>

      <ModelSettings key={`${modelSettingsOpen}-${modelConfig.protocol}-${modelConfig.model}`} open={modelSettingsOpen} value={modelConfig} onClose={() => setModelSettingsOpen(false)} onSave={setModelConfig} />
    </main>
  );
}
