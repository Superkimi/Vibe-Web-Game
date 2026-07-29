"use client";

import { create } from "zustand";
import { defaultProject } from "./default-project";
import { gameProjectSchema, type GameEntity, type GameProject } from "./game-schema";

export type StudioSnapshot = {
  id: string;
  label: string;
  createdAt: string;
  project: GameProject;
};

type StudioState = {
  project: GameProject;
  selectedEntityId: string | null;
  isPlaying: boolean;
  isPaused: boolean;
  history: StudioSnapshot[];
  future: StudioSnapshot[];
  setSelectedEntityId: (id: string | null) => void;
  setPlaying: (value: boolean) => void;
  setPaused: (value: boolean) => void;
  commit: (project: GameProject, label: string) => void;
  updateSelectedEntity: (patch: Partial<GameEntity>, label?: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  hydrate: (project: GameProject) => void;
};

const STORAGE_KEY = "vibe-web-game-project-v1";

function snapshot(project: GameProject, label: string): StudioSnapshot {
  return {
    id: crypto.randomUUID(),
    label,
    createdAt: new Date().toISOString(),
    project: structuredClone(project),
  };
}

function persist(project: GameProject) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // Storage can be unavailable in privacy modes; the in-memory editor still works.
  }
}

export const useStudioStore = create<StudioState>((set, get) => ({
  project: structuredClone(defaultProject),
  selectedEntityId: "player",
  isPlaying: false,
  isPaused: false,
  history: [],
  future: [],
  setSelectedEntityId: (selectedEntityId) => set({ selectedEntityId }),
  setPlaying: (isPlaying) => set({ isPlaying, isPaused: false }),
  setPaused: (isPaused) => set({ isPaused }),
  commit: (project, label) => {
    const validated = gameProjectSchema.parse(project);
    const current = get().project;
    persist(validated);
    set((state) => ({
      project: validated,
      history: [...state.history.slice(-39), snapshot(current, label)],
      future: [],
    }));
  },
  updateSelectedEntity: (patch, label = "Edit entity") => {
    const state = get();
    const project = structuredClone(state.project);
    const scene = project.scenes.find((item) => item.id === project.activeSceneId);
    const entity = scene?.entities.find((item) => item.id === state.selectedEntityId);
    if (!entity) return;
    Object.assign(entity, patch);
    project.meta.updatedAt = new Date().toISOString();
    state.commit(project, label);
  },
  undo: () => {
    const state = get();
    const previous = state.history.at(-1);
    if (!previous) return;
    persist(previous.project);
    set({
      project: structuredClone(previous.project),
      history: state.history.slice(0, -1),
      future: [snapshot(state.project, "Redo"), ...state.future].slice(0, 40),
    });
  },
  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) return;
    persist(next.project);
    set({
      project: structuredClone(next.project),
      history: [...state.history, snapshot(state.project, "Undo")].slice(-40),
      future: state.future.slice(1),
    });
  },
  reset: () => {
    const project = structuredClone(defaultProject);
    persist(project);
    set({
      project,
      selectedEntityId: "player",
      history: [],
      future: [],
      isPlaying: false,
      isPaused: false,
    });
  },
  hydrate: (project) => {
    const validated = gameProjectSchema.parse(project);
    set({ project: validated });
  },
}));

export function loadPersistedProject(): GameProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? gameProjectSchema.parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

