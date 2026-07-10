import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  Key,
  Image as ImageIcon,
  Palette,
  Plus,
  Pencil,
  Trash2,
  Layers,
} from "lucide-react";
import { useSettingsStore } from "@/store/settings";
import { getRendererMode } from "@/engine/renderer-config";
import {
  useCustomThemeStore,
  generateCustomThemeId,
} from "@/store/custom-themes";
import { BUILTIN_THEMES } from "@/themes";
import { PROVIDER_PRESETS } from "@/types/llm";
import type { LLMProviderId } from "@/types/llm";
import type { Theme } from "@/types/theme";
import { ThemeEditorDialog } from "@/components/theme-editor-dialog";

export default function Settings() {
  const navigate = useNavigate();
  const {
    settings,
    loaded,
    load,
    setActiveProvider,
    updateProvider,
    setImageEnabled,
    setImageProvider,
  } = useSettingsStore();
  const customThemes = useCustomThemeStore((s) => s.themes);
  const loadCustomThemes = useCustomThemeStore((s) => s.load);
  const saveTheme = useCustomThemeStore((s) => s.save);
  const removeTheme = useCustomThemeStore((s) => s.remove);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void load();
    void loadCustomThemes();
  }, [load, loadCustomThemes]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-bg-surface px-6 py-3">
        <button
          onClick={() => navigate("/")}
          className="rounded-md p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-lg font-semibold">设置</span>
      </header>

      <main className="flex-1 overflow-auto px-12 py-10">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* LLM 配置 */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Key className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">LLM 模型配置</h2>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm text-text-secondary">
                默认模型
              </label>
              <select
                value={settings.activeProvider}
                onChange={(e) =>
                  setActiveProvider(e.target.value as LLMProviderId)
                }
                className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                {(Object.keys(PROVIDER_PRESETS) as LLMProviderId[]).map(
                  (id) => (
                    <option key={id} value={id}>
                      {PROVIDER_PRESETS[id].label}
                    </option>
                  ),
                )}
              </select>
            </div>

            {loaded && (
              <div className="space-y-4">
                {(Object.keys(PROVIDER_PRESETS) as LLMProviderId[]).map(
                  (id) => {
                    const cfg = settings.providers[id];
                    if (!cfg) return null;
                    const isActive = settings.activeProvider === id;
                    return (
                      <div
                        key={id}
                        className={`rounded-lg border p-4 ${
                          isActive
                            ? "border-accent bg-accent-soft/30"
                            : "border-border bg-bg-surface"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="font-medium">{cfg.label}</span>
                          {isActive && (
                            <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-white">
                              当前使用
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs text-text-muted">
                              Base URL
                            </label>
                            <input
                              type="text"
                              value={cfg.baseUrl}
                              onChange={(e) =>
                                updateProvider(id, { baseUrl: e.target.value })
                              }
                              className="w-full rounded-md border border-border bg-bg-base px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-text-muted">
                              模型名称
                            </label>
                            <input
                              type="text"
                              value={cfg.model}
                              onChange={(e) =>
                                updateProvider(id, { model: e.target.value })
                              }
                              className="w-full rounded-md border border-border bg-bg-base px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="mb-1 block text-xs text-text-muted">
                            API Key
                          </label>
                          <input
                            type="password"
                            value={cfg.apiKey}
                            onChange={(e) =>
                              updateProvider(id, { apiKey: e.target.value })
                            }
                            placeholder="sk-..."
                            className="w-full rounded-md border border-border bg-bg-base px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </section>

          {/* 自定义主题 */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold">自定义主题</h2>
              </div>
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
              >
                <Plus className="h-3.5 w-3.5" />
                新建
              </button>
            </div>

            {customThemes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-muted">
                暂无自定义主题，点击「新建」开始创建
              </div>
            ) : (
              <div className="space-y-2">
                {customThemes.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-bg-surface px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-5 w-5 rounded-full border border-border"
                        style={{ background: t.colors.primary }}
                      />
                      <div>
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-text-muted">
                          {t.colors.background} / {t.spacing}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingTheme(t)}
                        className="rounded p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`确定删除主题「${t.name}」？`)) {
                            await removeTheme(t.id);
                          }
                        }}
                        className="rounded p-1.5 text-text-muted hover:bg-red-100/10 hover:text-red-400"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* AI 配图 */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold">AI 配图</h2>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <span className="text-sm text-text-muted">启用</span>
                <input
                  type="checkbox"
                  checked={settings.imageEnabled}
                  onChange={(e) => setImageEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-accent"
                />
              </label>
            </div>

            {settings.imageEnabled && (
              <div className="space-y-4 rounded-lg border border-border bg-bg-surface p-4">
                <p className="text-sm text-text-muted">
                  使用 OpenAI 兼容 API 生成配图（如
                  DALL-E）。未单独配置时将使用当前 LLM Provider。
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-text-muted">
                      Base URL
                    </label>
                    <input
                      type="text"
                      value={settings.imageProvider?.baseUrl ?? ""}
                      onChange={(e) =>
                        setImageProvider({
                          ...(settings.imageProvider ?? {
                            id: "custom",
                            label: "图片生成",
                            model: "dall-e-3",
                            apiKey: "",
                            enabled: true,
                          }),
                          baseUrl: e.target.value,
                        })
                      }
                      placeholder={
                        settings.providers[settings.activeProvider]?.baseUrl
                      }
                      className="w-full rounded-md border border-border bg-bg-base px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-text-muted">
                      模型
                    </label>
                    <input
                      type="text"
                      value={settings.imageProvider?.model ?? "dall-e-3"}
                      onChange={(e) =>
                        setImageProvider({
                          ...(settings.imageProvider ?? {
                            id: "custom",
                            label: "图片生成",
                            baseUrl: "",
                            apiKey: "",
                            enabled: true,
                          }),
                          model: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-border bg-bg-base px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={settings.imageProvider?.apiKey ?? ""}
                    onChange={(e) =>
                      setImageProvider({
                        ...(settings.imageProvider ?? {
                          id: "custom",
                          label: "图片生成",
                          baseUrl: "",
                          model: "dall-e-3",
                          enabled: true,
                        }),
                        apiKey: e.target.value,
                      })
                    }
                    placeholder="sk-..."
                    className="w-full rounded-md border border-border bg-bg-base px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            )}
          </section>

          {/* 渲染管线（feature flag） */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Layers className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">渲染管线</h2>
            </div>
            <div className="space-y-2 rounded-lg border border-border bg-bg-surface p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">当前渲染模式</span>
                <span className="rounded bg-bg-elevated px-2 py-0.5 font-mono text-xs text-text-primary">
                  {getRendererMode()}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-text-muted">
                Preview 与 PPTX 导出共享统一的 RenderIR
                渲染中间层。旧渲染器已在迁移完成后移除，
                如要临时切换，可设置环境变量
                <code className="mx-1 rounded bg-bg-elevated px-1">
                  VITE_RENDERER_MODE
                </code>
                并重新构建。
              </p>
            </div>
          </section>
        </div>
      </main>

      {creating && (
        <ThemeEditorDialog
          theme={{
            id: generateCustomThemeId(),
            name: "新建主题",
            colors: {
              primary: "#1e40af",
              secondary: "#3b82f6",
              accent: "#f59e0b",
              background: "#ffffff",
              surface: "#f8fafc",
              text: "#1e293b",
              textMuted: "#94a3b8",
            },
            fonts: { title: "sans-serif", body: "sans-serif" },
            fontSize: { h1: 44, h2: 32, body: 18, caption: 14 },
            spacing: "comfortable" as const,
            layouts: BUILTIN_THEMES[0]!.layouts,
          }}
          onSave={async (t) => {
            await saveTheme(t);
          }}
          onClose={() => setCreating(false)}
        />
      )}

      {editingTheme && (
        <ThemeEditorDialog
          theme={editingTheme}
          onSave={async (t) => {
            await saveTheme(t);
          }}
          onDelete={async () => {
            await removeTheme(editingTheme.id);
          }}
          onClose={() => setEditingTheme(null)}
        />
      )}
    </div>
  );
}
