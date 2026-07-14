import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ChevronLeft, Key, Image as ImageIcon } from "lucide-react";
import { useSettingsStore } from "@/store/settings";
import { PROVIDER_PRESETS } from "@/types/llm";
import type { LLMProviderId } from "@/types/llm";

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

  useEffect(() => {
    void load();
  }, [load]);

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
        </div>
      </main>
    </div>
  );
}
