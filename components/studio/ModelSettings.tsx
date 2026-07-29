"use client";

import { useState } from "react";
import { CheckCircle, Eye, EyeSlash, X } from "@phosphor-icons/react";

export type ModelConfig = {
  protocol: "openai" | "anthropic";
  providerName: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
};

export const MODEL_STORAGE_KEY = "vibe-web-game-model-config-v1";

export const defaultModelConfig: ModelConfig = {
  protocol: "openai",
  providerName: "OpenAI compatible",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4.1-mini",
  apiKey: "",
  temperature: 0.2,
};

const presets: Array<Omit<ModelConfig, "apiKey" | "temperature">> = [
  {
    providerName: "OpenAI",
    protocol: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
  },
  {
    providerName: "Anthropic",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-6",
  },
  {
    providerName: "DeepSeek",
    protocol: "openai",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  {
    providerName: "OpenRouter",
    protocol: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4.1-mini",
  },
];

export function loadModelConfig() {
  try {
    const value = localStorage.getItem(MODEL_STORAGE_KEY);
    return value ? ({ ...defaultModelConfig, ...JSON.parse(value) } as ModelConfig) : defaultModelConfig;
  } catch {
    return defaultModelConfig;
  }
}

export function ModelSettings({
  open,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  value: ModelConfig;
  onClose: () => void;
  onSave: (value: ModelConfig) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [showKey, setShowKey] = useState(false);

  if (!open) return null;

  const save = () => {
    localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(draft));
    onSave(draft);
    onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>AI MODEL</span>
            <h2 id="model-settings-title">Model connection</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </header>

        <div className="provider-presets" aria-label="Provider presets">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset.providerName}
              className={draft.providerName === preset.providerName ? "active" : ""}
              onClick={() => setDraft({ ...draft, ...preset })}
            >
              {preset.providerName}
            </button>
          ))}
        </div>

        <div className="settings-form">
          <label>
            <span>Protocol</span>
            <select
              value={draft.protocol}
              onChange={(event) =>
                setDraft({ ...draft, protocol: event.target.value as ModelConfig["protocol"] })
              }
            >
              <option value="openai">OpenAI compatible</option>
              <option value="anthropic">Anthropic Messages</option>
            </select>
          </label>
          <label>
            <span>Provider name</span>
            <input
              value={draft.providerName}
              onChange={(event) => setDraft({ ...draft, providerName: event.target.value })}
            />
          </label>
          <label className="wide-field">
            <span>Base URL</span>
            <input
              value={draft.baseUrl}
              inputMode="url"
              onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
            />
            <small>HTTPS endpoints only. Private network addresses are rejected.</small>
          </label>
          <label>
            <span>Model ID</span>
            <input
              value={draft.model}
              onChange={(event) => setDraft({ ...draft, model: event.target.value })}
            />
          </label>
          <label>
            <span>Temperature</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={draft.temperature}
              onChange={(event) =>
                setDraft({ ...draft, temperature: Number(event.target.value) })
              }
            />
          </label>
          <label className="wide-field">
            <span>API key</span>
            <div className="secret-input">
              <input
                type={showKey ? "text" : "password"}
                value={draft.apiKey}
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste a key from your model provider"
                onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowKey((visible) => !visible)}
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? <EyeSlash size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <small>The key stays in this browser and is sent only when you ask the model to edit.</small>
          </label>
        </div>

        <footer>
          <div className="security-note">
            <CheckCircle size={17} weight="fill" />
            Keys are never returned by the server or written into a project export.
          </div>
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={save}>
            Save model
          </button>
        </footer>
      </section>
    </div>
  );
}
