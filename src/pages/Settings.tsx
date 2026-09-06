import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ChevronLeft, Key, Image as ImageIcon, Sparkles } from "lucide-react";
import { useSettingsStore } from "@/store/settings";
import { PROVIDER_PRESETS } from "@/types/llm";
import type { LLMProviderId } from "@/types/llm";
import type { Lang, ThemeMode } from "@/types/preferences";
import { useT } from "@/hooks/use-page-t";

const THEME_OPTIONS: {
  value: ThemeMode;
  key: "settings.themeLight" | "settings.themeDark" | "settings.themeSystem";
}[] = [
  { value: "light", key: "settings.themeLight" },
  { value: "dark", key: "settings.themeDark" },
  { value: "system", key: "settings.themeSystem" },
];

const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

export default function Settings() {
  const navigate = useNavigate();
  const t = useT();
  const {
    settings,
    loaded,
    load,
    setActiveProvider,
    updateProvider,
    setImageEnabled,
    setImageProvider,
    setPexelsApiKey,
    setTtsEnabled,
    setTtsVoice,
    setResearch,
    setLang,
    setTheme,
  } = useSettingsStore();

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-bg-elevated px-6 py-3">
        <button
          onClick={() => navigate("/")}
          className="rounded-md p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-lg font-semibold">{t("common.settings")}</span>
      </header>

      <main className="flex-1 overflow-auto px-12 py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* ===== 通用 ===== */}
          <section className="overflow-hidden rounded-2xl border border-border bg-bg-elevated">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Sparkles className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">{t("settings.general")}</h2>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <div className="mb-2 text-xs text-text-muted">
                  {t("common.language")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LANG_OPTIONS.map((opt) => {
                    const selected = settings.lang === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLang(opt.value)}
                        aria-pressed={selected}
                        className={[
                          "rounded-md px-3 py-1.5 text-sm transition",
                          selected
                            ? "bg-accent text-white"
                            : "bg-bg-surface text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs text-text-muted">
                  {t("common.theme")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {THEME_OPTIONS.map((opt) => {
                    const selected = settings.theme === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTheme(opt.value)}
                        aria-pressed={selected}
                        className={[
                          "rounded-md px-3 py-1.5 text-sm transition",
                          selected
                            ? "bg-accent text-white"
                            : "bg-bg-surface text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                        ].join(" ")}
                      >
                        {t(opt.key)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* ===== 模型设置 ===== */}
          <section className="overflow-hidden rounded-2xl border border-border bg-bg-elevated">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Key className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">
                {t("settings.modelSection")}
              </h2>
            </div>

            <div className="space-y-5 p-5">
              {/* 当前默认模型：一眼可见 */}
              <div className="flex items-center gap-3 rounded-xl bg-accent-soft/40 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white">
                  <Key className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-muted">
                    {t("settings.currentModel")}
                  </div>
                  <div className="truncate font-medium text-text-primary">
                    {settings.providers[settings.activeProvider]
                      ? `${settings.providers[settings.activeProvider]!.label} · ${
                          settings.providers[settings.activeProvider]!.model
                        }`
                      : t("common.loading")}
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
                              : "border-border bg-bg-elevated hover:border-accent/50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveProvider(id)}
                            className="mb-3 flex w-full items-center justify-between text-left"
                          >
                            <span className="font-medium text-text-primary">
                              {cfg.label}
                              {cfg.apiKey == null ||
                              cfg.apiKey.trim() === "" ? (
                                <span className="text-xs text-red-500 ml-1">
                                  {t("settings.missingApiKey")}
                                </span>
                              ) : null}
                            </span>
                            {isActive && (
                              <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-white">
                                {t("settings.inUse")}
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
                                className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-text-muted">
                                {t("settings.modelName")}
                              </label>
                              <input
                                type="text"
                                value={cfg.model}
                                onChange={(e) =>
                                  updateProvider(id, { model: e.target.value })
                                }
                                className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
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
                              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                            />
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}

              {/* 旁白 TTS */}
              <div className="border-t border-border pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">
                      {t("settings.ttsSection")}
                    </h3>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2">
                    <span className="text-sm text-text-muted">
                      {t("settings.enable")}
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.ttsEnabled ?? false}
                      onChange={(e) => setTtsEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-accent"
                    />
                  </label>
                </div>
                {settings.ttsEnabled && (
                  <div className="space-y-3 rounded-xl border border-border bg-bg-surface p-4">
                    <p className="text-sm text-text-muted">
                      {t("settings.ttsHelp")}
                    </p>
                    <div>
                      <label className="mb-1 block text-xs text-text-muted">
                        {t("settings.ttsVoice")}
                      </label>
                      <select
                        value={settings.ttsVoice ?? "alloy"}
                        onChange={(e) => setTtsVoice(e.target.value)}
                        className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                      >
                        {[
                          "alloy",
                          "echo",
                          "fable",
                          "onyx",
                          "nova",
                          "shimmer",
                        ].map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 联网资料补全 */}
              <div className="border-t border-border pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-text-primary">
                    {t("settings.researchSection")}
                  </h3>
                  <label className="flex cursor-pointer items-center gap-2">
                    <span className="text-sm text-text-muted">
                      {t("settings.researchEnable")}
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.researchEnabled ?? false}
                      onChange={(e) =>
                        setResearch({ enabled: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-border accent-accent"
                    />
                  </label>
                </div>
                {settings.researchEnabled && (
                  <div className="space-y-3 rounded-xl border border-border bg-bg-surface p-4">
                    <p className="text-sm text-text-muted">
                      {t("settings.researchHelp")}
                    </p>
                    <div>
                      <label className="mb-1 block text-xs text-text-muted">
                        {t("settings.tavilyKey")}
                      </label>
                      <input
                        type="password"
                        value={settings.tavilyApiKey ?? ""}
                        onChange={(e) =>
                          setResearch({ apiKey: e.target.value })
                        }
                        className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* AI 配图 */}
              <div className="border-t border-border pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-accent" />
                    <h3 className="font-semibold text-text-primary">
                      {t("settings.imageSection")}
                    </h3>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2">
                    <span className="text-sm text-text-muted">
                      {t("settings.enable")}
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.imageEnabled}
                      onChange={(e) => setImageEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-accent"
                    />
                  </label>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs text-text-muted">
                    {t("settings.pexelsKey")}
                  </label>
                  <input
                    type="password"
                    value={settings.pexelsApiKey ?? ""}
                    onChange={(e) => setPexelsApiKey(e.target.value)}
                    placeholder={t("settings.pexelsKeyPlaceholder")}
                    className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                  />
                </div>

                {settings.imageEnabled && (
                  <div className="space-y-3 rounded-xl border border-border bg-bg-surface p-4">
                    <p className="text-sm text-text-muted">
                      {t("settings.imageHelp")}
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
                                label: t("settings.imageGen"),
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
                          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-text-muted">
                          {t("settings.modelName")}
                        </label>
                        <input
                          type="text"
                          value={settings.imageProvider?.model ?? "dall-e-3"}
                          onChange={(e) =>
                            setImageProvider({
                              ...(settings.imageProvider ?? {
                                id: "custom",
                                label: t("settings.imageGen"),
                                baseUrl: "",
                                apiKey: "",
                                enabled: true,
                              }),
                              model: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
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
                              label: t("settings.imageGen"),
                              baseUrl: "",
                              model: "dall-e-3",
                              enabled: true,
                            }),
                            apiKey: e.target.value,
                          })
                        }
                        placeholder="sk-..."
                        className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
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
