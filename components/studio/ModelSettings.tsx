"use client";

import { useState } from "react";
import { CheckCircle, Eye, EyeSlash, X } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
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
            <span>{t("AI MODEL")}</span>
            <h2 id="model-settings-title">{t("Model connection")}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("Close settings")}>
            <X size={18} />
          </button>
        </header>

        <div className="provider-presets" aria-label={t("Provider presets")}>
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
            <span>{t("Protocol")}</span>
            <select
              value={draft.protocol}
              onChange={(event) =>
                setDraft({ ...draft, protocol: event.target.value as ModelConfig["protocol"] })
              }
            >
              <option value="openai">{t("OpenAI compatible")}</option>
              <option value="anthropic">{t("Anthropic Messages")}</option>
            </select>
          </label>
          <label>
            <span>{t("Provider name")}</span>
            <input
              value={draft.providerName}
              onChange={(event) => setDraft({ ...draft, providerName: event.target.value })}
            />
          </label>
          <label className="wide-field">
            <span>{t("Base URL")}</span>
            <input
              value={draft.baseUrl}
              inputMode="url"
              onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
            />
            <small>{t("HTTPS endpoints only. Private network addresses are rejected.")}</small>
          </label>
          <label>
            <span>{t("Model ID")}</span>
            <input
              value={draft.model}
              onChange={(event) => setDraft({ ...draft, model: event.target.value })}
            />
          </label>
          <label>
            <span>{t("Temperature")}</span>
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
            <span>{t("API key")}</span>
            <div className="secret-input">
              <input
                type={showKey ? "text" : "password"}
                value={draft.apiKey}
                autoComplete="off"
                spellCheck={false}
                placeholder={t("Paste a key from your model provider")}
                onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowKey((visible) => !visible)}
                aria-label={showKey ? t("Hide API key") : t("Show API key")}
              >
                {showKey ? <EyeSlash size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <small>{t("The key stays in this browser and is sent only when you ask the model to edit.")}</small>
          </label>
        </div>

        <footer>
          <div className="security-note">
            <CheckCircle size={17} weight="fill" />
            {t("Keys are never returned by the server or written into a project export.")}
          </div>
          <button className="secondary-button" type="button" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button className="primary-button" type="button" onClick={save}>
            {t("Save model")}
          </button>
        </footer>
      </section>
    </div>
  );
}
