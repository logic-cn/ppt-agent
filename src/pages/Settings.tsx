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
} from "lucide-react";
import { useSettingsStore } from "@/store/settings";
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
      <header className="flex items-center gap-3 border-b border-border bg-white px-6 py-3">
        <button
          onClick={() => navigate("/")}
          className="rounded-md p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-lg font-semibold">设置</span>
      </header>

      <main className="flex-1 overflow-auto px-12 py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* ===== 模型设置 ===== */}
          <section className="overflow-hidden rounded-2xl border border-border bg-white">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Key className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">模型设置</h2>
            </div>

            <div className="space-y-5 p-5">
              {/* 当前默认模型：一眼可见 */}
              <div className="flex items-center gap-3 rounded-xl bg-accent-soft/40 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white">
                  <Key className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-muted">当前默认模型</div>
                  <div className="truncate font-medium text-text-primary">
                    {settings.providers[settings.activeProvider]
                      ? `${settings.providers[settings.activeProvider]!.label} · ${
                          settings.providers[settings.activeProvider]!.model
                        }`
                      : "加载中…"}
                  </div>
                </div>
              </div>

              {/* 提供商选择：点击卡片切换，去除下拉框 */}
              {loaded && (
                <div className="space-y-3">
                  {(Object.keys(PROVIDER_PRESETS) as LLMProviderId[]).map(
                    (id) => {
                      const cfg = settings.providers[id];
                      if (!cfg) return null;
                      const isActive = settings.activeProvider === id;
                      return (
                        <div
                          key={id}
                          className={`rounded-xl border p-4 transition-colors ${
                            isActive
                              ? "border-accent bg-accent-soft/30"
                              : "border-border bg-white hover:border-accent/50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveProvider(id)}
                            className="mb-3 flex w-full items-center justify-between text-left"
                          >
                            <span className="font-medium text-text-primary">
                              {cfg.label}
                            </span>
                            {isActive && (
                              <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-white">
                                当前使用
                              </span>
                            )}
                          </button>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-xs text-text-muted">
                                Base URL
                              </label>
                              <input
                                type="text"
                                value={cfg.baseUrl}
                                onChange={(e) =>
                                  updateProvider(id, {
                                    baseUrl: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
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
                                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
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
                              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                            />
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}

              {/* AI 配图 */}
              <div className="border-t border-border pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-accent" />
                    <h3 className="font-semibold text-text-primary">AI 配图</h3>
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
                  <div className="space-y-3 rounded-xl border border-border bg-bg-surface p-4">
                    <p className="text-sm text-text-muted">
                      使用 OpenAI 兼容 API 生成配图（如
                      DALL·E）。未单独配置时将使用当前 LLM Provider。
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
                          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
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
                          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
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
                        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ===== 自定义主题 ===== */}
          <section className="overflow-hidden rounded-2xl border border-border bg-white">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold">自定义主题</h2>
              </div>
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-accent to-purple-500 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                新建
              </button>
            </div>

            <div className="p-5">
              {customThemes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-muted">
                  暂无自定义主题，点击「新建」开始创建
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {customThemes.map((t) => (
                    <div
                      key={t.id}
                      className="overflow-hidden rounded-xl border border-border bg-white"
                    >
                      {/* 样式预览：直接展示主题视觉效果 */}
                      <div
                        className="space-y-2 p-3"
                        style={{ background: t.colors.background }}
                      >
                        <div
                          className="h-1.5 w-12 rounded-full"
                          style={{ background: t.colors.primary }}
                        />
                        <div
                          className="truncate text-sm font-semibold"
                          style={{ color: t.colors.text }}
                        >
                          {t.name}
                        </div>
                        <div
                          className="truncate text-xs"
                          style={{ color: t.colors.textMuted }}
                        >
                          幻灯片标题示例文本
                        </div>
                        <div
                          className="inline-flex items-center rounded-md px-2 py-1 text-xs text-white"
                          style={{ background: t.colors.accent }}
                        >
                          示例按钮
                        </div>
                      </div>
                      {/* 底部：调色板 + 操作 */}
                      <div className="flex items-center justify-between border-t border-border px-3 py-2">
                        <div className="flex gap-1">
                          {[
                            t.colors.primary,
                            t.colors.secondary,
                            t.colors.accent,
                            t.colors.background,
                            t.colors.text,
                          ].map((c, i) => (
                            <span
                              key={i}
                              className="h-3.5 w-3.5 rounded-full border border-black/10"
                              style={{ background: c }}
                            />
                          ))}
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
                    </div>
                  ))}
                </div>
              )}
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
