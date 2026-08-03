"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Language = "en" | "zh";

export const LANGUAGE_STORAGE_KEY = "vibe-web-game-language-v1";

type MessageValues = Record<string, string | number>;

const zhMessages: Record<string, string> = {
  "Phaser Studio": "Phaser 工作室",
  "Saved locally": "已保存到本地",
  Import: "导入",
  Export: "导出",
  Model: "模型",
  "Project actions": "项目操作",
  Undo: "撤销",
  Redo: "重做",
  "Switch language": "切换语言",
  "Scene entities": "场景对象",
  Scene: "场景",
  Assets: "素材",
  "Project assets": "项目素材",
  "Add object": "添加对象",
  "Import image": "导入图片",
  "Import an image": "导入一张图片",
  "PNG, JPEG, WebP or GIF · max 1.5 MB": "PNG、JPEG、WebP 或 GIF · 最大 1.5 MB",
  "Place sprite": "放置精灵",
  "{count} objects": "{count} 个对象",
  "{count} behaviors": "{count} 个行为",
  "{count} assets": "{count} 个素材",
  "Local project": "本地项目",
  off: "关闭",
  Edit: "编辑",
  Play: "运行",
  "Stop game": "停止游戏",
  "Run game": "运行游戏",
  "Resume game": "继续游戏",
  "Pause game": "暂停游戏",
  "Arrow keys or WASD to move. Space to jump.": "使用方向键或 WASD 移动，按空格键跳跃。",
  "Drag objects on canvas. Edit precise values in Inspector.": "在画布上拖动对象，在检查器中编辑精确数值。",
  Output: "输出",
  Schema: "Schema",
  History: "历史",
  "Validate & apply": "校验并应用",
  Clear: "清空",
  "Run or edit the scene to see validation and runtime messages.": "运行或编辑场景后，这里会显示校验和运行时消息。",
  "Every manual or AI change creates a recoverable snapshot.": "每次手动或 AI 修改都会创建可恢复的快照。",
  Inspector: "检查器",
  Vibe: "Vibe",
  "Project settings": "项目设置",
  Game: "游戏",
  Viewport: "视口",
  Width: "宽度",
  Height: "高度",
  Background: "背景",
  Name: "名称",
  Description: "描述",
  "Gravity Y": "Y 轴重力",
  "Pixel art rendering": "像素画渲染",
  Identity: "标识",
  Type: "类型",
  Transform: "变换",
  Rotation: "旋转",
  "Scale X": "X 缩放",
  "Scale Y": "Y 缩放",
  Appearance: "外观",
  Color: "颜色",
  Opacity: "不透明度",
  Text: "文本",
  Physics: "物理",
  Enabled: "启用",
  "Static body": "静态刚体",
  "World bounds": "世界边界",
  Bounce: "反弹",
  Behaviors: "行为",
  "playerController": "玩家控制",
  patrol: "巡逻",
  collectible: "可收集物",
  cameraFollow: "镜头跟随",
  bounce: "弹跳",
  Duplicate: "复制",
  Delete: "删除",
  "Configure model": "配置模型",
  "Describe a playable change. I will propose validated operations, show the diff, and wait for approval before touching the scene.": "描述一个可玩的改动。我会提出经过校验的操作，展示差异，等待你批准后再修改场景。",
  "Connect a model first. Your API key stays on this device and is only forwarded for this request.": "请先连接模型。你的 API Key 会保存在此设备上，仅在本次请求中转发。",
  "AI proposed {count} validated operations.": "AI 提出了 {count} 个经过校验的操作。",
  "AI request failed": "AI 请求失败",
  "Validating a playable change set…": "正在校验可玩的变更集合……",
  "PROPOSED CHANGE": "提议的变更",
  "Verification plan": "验证计划",
  Reject: "拒绝",
  "Apply change": "应用变更",
  "Applied. The scene and schema are now in sync.": "已应用。场景与 Schema 现在保持同步。",
  "Describe the game change you want…": "描述你想要的游戏改动……",
  "Schema-safe edit": "Schema 安全编辑",
  You: "你",
  Build: "生成",
  "Add a moving platform above the player.": "在玩家上方添加一个移动平台。",
  "Make the level feel more playful with a brighter palette.": "使用更明亮的配色，让关卡更有趣。",
  "Add two collectibles on the right side and explain the change.": "在右侧添加两个可收集物，并解释这次改动。",
  "New object": "新对象",
  "New text": "新文本",
  "Only image assets are supported in this release.": "当前版本只支持图片素材。",
  "Keep image assets under 1.5 MB so local project saves stay reliable.": "请将图片素材控制在 1.5 MB 以内，以保证本地项目保存可靠。",
  "Could not read image": "无法读取图片",
  "Imported {name}. Click it to place a sprite.": "已导入 {name}。点击它即可放置精灵。",
  "Schema edit validated and applied.": "Schema 编辑已校验并应用。",
  "Apply schema edit": "应用 Schema 编辑",
  "Project exported.": "项目已导出。",
  "Imported {name}.": "已导入 {name}。",
  "Project reset to the starter scene.": "项目已重置为起始场景。",
  "Move object on canvas": "在画布上移动对象",
  "Edit entity": "编辑对象",
  "Import asset {name}": "导入素材 {name}",
  "Duplicate {name}": "复制 {name}",
  "Delete {name}": "删除 {name}",
  "Add {type}": "添加{type}",
  "Remove {type}": "移除{type}",
  "Rename project": "重命名项目",
  "Edit project description": "编辑项目描述",
  "Change viewport width": "修改视口宽度",
  "Change viewport height": "修改视口高度",
  "Change gravity": "修改重力",
  "Toggle pixel art": "切换像素画",
  "Rename scene": "重命名场景",
  "Change scene background": "修改场景背景",
  "Toggle object": "切换对象状态",
  "Rename object": "重命名对象",
  "Change X": "修改 X",
  "Change Y": "修改 Y",
  "Rotate object": "旋转对象",
  "Scale object": "缩放对象",
  "Resize object": "调整对象尺寸",
  "Change color": "修改颜色",
  "Change opacity": "修改不透明度",
  "Edit text": "编辑文本",
  "Toggle physics": "切换物理",
  "Change body type": "修改刚体类型",
  "Change bounds": "修改边界",
  "Change bounce": "修改反弹",
  "AI: {summary}": "AI：{summary}",
  "Running {name}": "正在运行 {name}",
  "Editor scene loaded: {name}": "编辑器已加载场景：{name}",
  "Collected {name}": "已收集 {name}",
  "All collectibles found. Level complete.": "已找到全部可收集物，关卡完成。",
  "SCORE  {score}": "得分  {score}",
  "LEVEL COMPLETE": "关卡完成",
  "Reset starter": "重置起始场景",
  "Local-first": "本地优先",
  "AI MODEL": "AI 模型",
  "Model connection": "模型连接",
  "Close settings": "关闭设置",
  "Provider presets": "服务商预设",
  Protocol: "协议",
  "OpenAI compatible": "OpenAI 兼容",
  "Anthropic Messages": "Anthropic Messages",
  "Provider name": "服务商名称",
  "Base URL": "基础 URL",
  "HTTPS endpoints only. Private network addresses are rejected.": "仅支持 HTTPS 地址，私有网络地址会被拒绝。",
  "Model ID": "模型 ID",
  Temperature: "温度",
  "API key": "API Key",
  "Paste a key from your model provider": "粘贴模型服务商提供的 Key",
  "The key stays in this browser and is sent only when you ask the model to edit.": "Key 只保存在当前浏览器，仅在你请求模型修改时发送。",
  "Keys are never returned by the server or written into a project export.": "Key 不会由服务器返回，也不会写入项目导出文件。",
  Cancel: "取消",
  "Save model": "保存模型",
  "Show API key": "显示 API Key",
  "Hide API key": "隐藏 API Key",
  "English": "English",
  "Chinese": "中文",
};

export function translateMessage(language: Language, key: string, values?: MessageValues) {
  const template = language === "zh" ? zhMessages[key] ?? key : key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? `{${name}}`));
}

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: MessageValues) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const browserLanguage = window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    const next = stored === "zh" || stored === "en" ? stored : browserLanguage;
    const frame = window.requestAnimationFrame(() => setLanguageState(next));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: string, values?: MessageValues) => translateMessage(language, key, values),
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
