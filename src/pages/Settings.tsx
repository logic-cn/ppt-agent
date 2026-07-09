import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ChevronLeft, Key, Image as ImageIcon } from "lucide-react";
import { useSettingsStore } from "@/store/settings";
import { PROVIDER_PRESETS } from "@/types/llm";
import type { LLMProviderId } from "@/types/llm";

export default function Settings() {
  const navigate = useNavigate();
  const { settings, loaded, load, setActiveProvider, updateProvider } =
    useSettingsStore();

  useEffect(() => {
    void load();
  }, [load]);

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

          {/* AI 配图配置（占位，M10 实现） */}
          <section className="opacity-50">
            <div className="mb-4 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">AI 配图</h2>
            </div>
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-muted">
              即将上线（M10 阶段）
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
