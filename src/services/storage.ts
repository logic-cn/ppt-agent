import type { AppSettings, Deck, DeckMeta } from "@/types";
import { PROVIDER_PRESETS } from "@/types/llm";
import { DEFAULT_THEME_ID } from "@/themes";

const CURRENT_DECK_VERSION = 1;
const CURRENT_SETTINGS_VERSION = 1;

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
    if (!saved.version) saved.version = CURRENT_SETTINGS_VERSION;
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
    const deck = JSON.parse(raw) as Deck;
    if (!deck.version) deck.version = CURRENT_DECK_VERSION;
    return deck;
  } catch {
    return null;
  }
}

export async function saveDeck(deck: Deck): Promise<void> {
  const dir = await getDataDir();
  const path = await joinPath(dir, "decks", `${deck.id}.json`);
  await writeText(path, JSON.stringify(deck, null, 2));
  await updateIndex(dir, {
    id: deck.id,
    title: deck.title,
    slidesCount: deck.slides.length,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
  });
}

// ---- 索引管理 ----

async function indexPath(dir: string): Promise<string> {
  return joinPath(dir, "decks", "index.json");
}

async function readIndex(dir: string): Promise<DeckMeta[] | null> {
  const path = await indexPath(dir);
  const raw = await readText(path);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as DeckMeta[];
  } catch {
    return null;
  }
}

async function writeIndex(dir: string, index: DeckMeta[]): Promise<void> {
  const path = await indexPath(dir);
  await writeText(path, JSON.stringify(index, null, 2));
}

async function updateIndex(dir: string, meta: DeckMeta): Promise<void> {
  const index = (await readIndex(dir)) || (await rebuildIndex(dir));
  if (!index) return;
  const existing = index.findIndex((m) => m.id === meta.id);
  if (existing !== -1) {
    index[existing] = meta;
  } else {
    index.push(meta);
  }
  index.sort((a, b) => b.updatedAt - a.updatedAt);
  await writeIndex(dir, index);
}

async function removeFromIndex(dir: string, id: string): Promise<void> {
  const index = (await readIndex(dir)) || (await rebuildIndex(dir));
  if (!index) return;
  const filtered = index.filter((m) => m.id !== id);
  await writeIndex(dir, filtered);
}

async function rebuildIndex(dir: string): Promise<DeckMeta[]> {
  const decksDir = await joinPath(dir, "decks");
  const index: DeckMeta[] = [];

  if (!isTauri) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        key.startsWith("ppt-agent-data/decks/") &&
        !key.endsWith("index.json")
      ) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const deck = JSON.parse(raw) as Deck;
            index.push({
              id: deck.id,
              title: deck.title,
              slidesCount: deck.slides.length,
              createdAt: deck.createdAt,
              updatedAt: deck.updatedAt,
            });
          } catch {
            /* skip */
          }
        }
      }
    }
  } else {
    try {
      const inv = await getInvoke();
      if (inv) {
        const names = await inv<string[]>("list_directory", { path: decksDir });
        for (const name of names) {
          if (name.endsWith(".json") && name !== "index.json") {
            const filePath = await joinPath(decksDir, name);
            const raw = await readText(filePath);
            if (raw) {
              try {
                const deck = JSON.parse(raw) as Deck;
                index.push({
                  id: deck.id,
                  title: deck.title,
                  slidesCount: deck.slides.length,
                  createdAt: deck.createdAt,
                  updatedAt: deck.updatedAt,
                });
              } catch {
                /* skip */
              }
            }
          }
        }
      }
    } catch {
      /* skip */
    }
  }

  index.sort((a, b) => b.updatedAt - a.updatedAt);
  await writeIndex(dir, index);
  return index;
}

export async function listDecks(): Promise<DeckMeta[]> {
  const dir = await getDataDir();
  const cached = await readIndex(dir);
  if (cached) return cached;
  return rebuildIndex(dir);
}

export async function deleteDeck(id: string): Promise<void> {
  const dir = await getDataDir();
  if (!isTauri) {
    localStorage.removeItem(`ppt-agent-data/decks/${id}.json`);
    await removeFromIndex(dir, id);
    return;
  }
  try {
    const inv = await getInvoke();
    if (!inv) return;
    const path = await joinPath(dir, "decks", `${id}.json`);
    await inv("delete_file", { path });
    await removeFromIndex(dir, id);
  } catch (e) {
    console.error("deleteDeck failed:", e);
  }
}

// ---- 工厂函数 ----

export function createEmptyDeck(title = "未命名项目"): Deck {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    version: CURRENT_DECK_VERSION,
    title,
    themeId: DEFAULT_THEME_ID,
    slides: [],
    createdAt: now,
    updatedAt: now,
  };
}
