import type { AppSettings, Deck } from "@/types";
import { PROVIDER_PRESETS } from "@/types/llm";
import { DEFAULT_THEME_ID } from "@/themes";

// 动态检测是否在 Tauri 环境中
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let invoke:
  (<T>(cmd: string, args?: Record<string, unknown>) => Promise<T>) | null =
  null;
let dataDir: string | null = null;

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

async function getInvoke(): Promise<InvokeFn | null> {
  if (!isTauri) return null;
  if (invoke) return invoke;
  const mod = await import("@tauri-apps/api/core");
  invoke = mod.invoke as InvokeFn;
  return invoke;
}

async function getDataDir(): Promise<string> {
  if (dataDir) return dataDir;
  if (!isTauri) {
    dataDir = "ppt-agent-data";
    return dataDir;
  }
  const inv = await getInvoke();
  if (!inv) {
    dataDir = "ppt-agent-data";
    return dataDir;
  }
  dataDir = await inv<string>("app_data_dir");
  return dataDir;
}

// ---- Tauri fs 路径 ----
async function readText(path: string): Promise<string | null> {
  const inv = await getInvoke();
  if (!inv) {
    return localStorage.getItem(path);
  }
  try {
    return await inv<string>("read_text_file", { path });
  } catch {
    return null;
  }
}

async function writeText(path: string, content: string): Promise<void> {
  const inv = await getInvoke();
  if (!inv) {
    localStorage.setItem(path, content);
    return;
  }
  await inv<void>("write_text_file", { path, content });
}

async function joinPath(...segments: string[]): Promise<string> {
  if (!isTauri) return segments.join("/");
  const mod = await import("@tauri-apps/api/path");
  return mod.join(...segments);
}

// ---- 公共 API ----

export async function loadSettings(): Promise<AppSettings | null> {
  const dir = await getDataDir();
  const path = await joinPath(dir, "settings.json");
  const raw = await readText(path);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as AppSettings;
    // 合并新预设（兼容旧版本）
    for (const id of Object.keys(
      PROVIDER_PRESETS,
    ) as (keyof typeof PROVIDER_PRESETS)[]) {
      if (!saved.providers[id]) {
        saved.providers[id] = {
          ...PROVIDER_PRESETS[id],
          apiKey: "",
          enabled: false,
        };
      }
    }
    return saved;
  } catch {
    return null;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const dir = await getDataDir();
  const path = await joinPath(dir, "settings.json");
  await writeText(path, JSON.stringify(settings, null, 2));
}

export async function loadDeck(id: string): Promise<Deck | null> {
  const dir = await getDataDir();
  const path = await joinPath(dir, "decks", `${id}.json`);
  const raw = await readText(path);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Deck;
  } catch {
    return null;
  }
}

export async function saveDeck(deck: Deck): Promise<void> {
  const dir = await getDataDir();
  const path = await joinPath(dir, "decks", `${deck.id}.json`);
  await writeText(path, JSON.stringify(deck, null, 2));
}

export async function listDecks(): Promise<Deck[]> {
  const dir = await getDataDir();
  const decksDir = await joinPath(dir, "decks");
  if (!isTauri) {
    // web fallback：扫描 localStorage
    const decks: Deck[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("ppt-agent-data/decks/")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            decks.push(JSON.parse(raw));
          } catch {
            // skip
          }
        }
      }
    }
    return decks.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  // Tauri 环境：通过 Rust 命令读取目录
  try {
    const inv = await getInvoke();
    if (!inv) return [];
    const names = await inv<string[]>("list_directory", { path: decksDir });
    const decks: Deck[] = [];
    for (const name of names) {
      if (name.endsWith(".json")) {
        const filePath = await joinPath(decksDir, name);
        const raw = await readText(filePath);
        if (raw) {
          try {
            decks.push(JSON.parse(raw));
          } catch {
            // skip
          }
        }
      }
    }
    return decks.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function deleteDeck(id: string): Promise<void> {
  if (!isTauri) {
    localStorage.removeItem(`ppt-agent-data/decks/${id}.json`);
    return;
  }
  try {
    const dir = await getDataDir();
    const path = await joinPath(dir, "decks", `${id}.json`);
    const { remove } = await import("@tauri-apps/plugin-fs");
    await remove(path);
  } catch {
    // ignore
  }
}

// ---- 工厂函数 ----

export function createEmptyDeck(title = "未命名项目"): Deck {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    themeId: DEFAULT_THEME_ID,
    slides: [],
    createdAt: now,
    updatedAt: now,
  };
}
