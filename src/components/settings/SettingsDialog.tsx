import { useEffect, useState } from "react";
import {
  X,
  Key,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useSettingsStore } from "@/store/settings";
import { PROVIDER_PRESETS } from "@/types/llm";
import type {
  AppSettings,
  BuiltinProviderId,
  CustomProviderId,
  LLMProviderConfig,
  LLMProviderId,
} from "@/types/llm";
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

type SettingsTab = "general" | "model";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: Props) {
  const t = useT();
  const [tab, setTab] = useState<SettingsTab>("general");
  const {
    settings,
    loaded,
    load,
    setActiveProvider,
    updateProvider,
    addCustomProvider,
    removeCustomProvider,
    setPexelsApiKey,
    setResearch,
    setLang,
    setTheme,
  } = useSettingsStore();

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Esc 关闭弹框
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const TABS: { id: SettingsTab; label: string; icon: typeof Sparkles }[] = [
    { id: "general", label: t("settings.general"), icon: Sparkles },
    { id: "model", label: t("settings.modelSection"), icon: Key },
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-bg-elevated shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2
            id="settings-dialog-title"
            className="text-base font-semibold"
          >
            {t("common.settings")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted transition hover:bg-bg-hover hover:text-text-primary"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* ===== 左侧导航 ===== */}
          <nav className="flex w-44 shrink-0 flex-col gap-1 border-r border-border p-3">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-pressed={active}
                  className={[
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition",
                    active
                      ? "bg-accent-soft/40 font-medium text-text-primary"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                  ].join(" ")}
                >
                  <Icon
                    className={`h-4 w-4 ${active ? "text-accent" : ""}`}
                  />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* ===== 右侧内容 ===== */}
          <main className="flex-1 overflow-auto px-8 py-6">
            {tab === "general" ? (
              <GeneralPanel
                settings={settings}
                setLang={setLang}
                setTheme={setTheme}
                t={t}
              />
            ) : (
              <ModelPanel
                settings={settings}
                loaded={loaded}
                t={t}
                setActiveProvider={setActiveProvider}
                updateProvider={updateProvider}
                addCustomProvider={addCustomProvider}
                removeCustomProvider={removeCustomProvider}
                setPexelsApiKey={setPexelsApiKey}
                setResearch={setResearch}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ===== 通用面板 ===== */

function GeneralPanel({
  settings,
  setLang,
  setTheme,
  t,
}: {
  settings: AppSettings;
  setLang: (lang: Lang) => void;
  setTheme: (theme: ThemeMode) => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
    </div>
  );
}

/* ===== 模型设置面板 ===== */

function ModelPanel({
  settings,
  loaded,
  t,
  setActiveProvider,
  updateProvider,
  addCustomProvider,
  removeCustomProvider,
  setPexelsApiKey,
  setResearch,
}: {
  settings: AppSettings;
  loaded: boolean;
  t: ReturnType<typeof useT>;
  setActiveProvider: (id: LLMProviderId) => void;
  updateProvider: (
    id: LLMProviderId,
    patch: Partial<
      Pick<LLMProviderConfig, "label" | "baseUrl" | "model" | "apiKey">
    >,
  ) => void;
  addCustomProvider: () => CustomProviderId;
  removeCustomProvider: (id: CustomProviderId) => void;
  setPexelsApiKey: (key: string) => void;
  setResearch: (patch: { enabled?: boolean; apiKey?: string }) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
                {(() => {
                  const cfg = settings.providers[settings.activeProvider];
                  if (!cfg) return t("common.loading");
                  return cfg.label
                    ? `${cfg.label} · ${cfg.model}`
                    : cfg.model || t("common.loading");
                })()}
              </div>
            </div>
          </div>

          {/* 提供商选择：内置 + 自定义，点击卡片头部切换 */}
          {loaded && (
            <div className="space-y-3">
              {(
                [
                  ...(Object.keys(PROVIDER_PRESETS) as BuiltinProviderId[]),
                  ...(Object.keys(settings.providers).filter((id) =>
                    id.startsWith("custom-"),
                  ) as CustomProviderId[]),
                ] as LLMProviderId[]
              ).map((id) => {
                  const cfg = settings.providers[id];
                  if (!cfg) return null;
                  const isCustom = id.startsWith("custom-");
                  return (
                    <ProviderCard
                      key={id}
                      id={id}
                      cfg={cfg}
                      isCustom={isCustom}
                      isActive={settings.activeProvider === id}
                      t={t}
                      setActiveProvider={setActiveProvider}
                      updateProvider={updateProvider}
                      removeCustomProvider={removeCustomProvider}
                    />
                  );
                })}

              {/* 添加自定义模型 */}
              <button
                type="button"
                onClick={() => addCustomProvider()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-text-secondary transition hover:border-accent/50 hover:text-text-primary"
              >
                <Plus className="h-4 w-4" />
                {t("settings.addCustomModel")}
              </button>
            </div>
          )}

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

            {/* 网络搜图 Pexels Key（可选） */}
            <div className="mt-5">
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
          </div>
        </div>
      </section>
    </div>
  );
}

/* ===== 单个提供商卡片 ===== */

function ProviderCard({
  id,
  cfg,
  isCustom,
  isActive,
  t,
  setActiveProvider,
  updateProvider,
  removeCustomProvider,
}: {
  id: LLMProviderId;
  cfg: LLMProviderConfig;
  isCustom: boolean;
  isActive: boolean;
  t: ReturnType<typeof useT>;
  setActiveProvider: (id: LLMProviderId) => void;
  updateProvider: (
    id: LLMProviderId,
    patch: Partial<
      Pick<LLMProviderConfig, "label" | "baseUrl" | "model" | "apiKey">
    >,
  ) => void;
  removeCustomProvider: (id: CustomProviderId) => void;
}) {
  const inputCls =
    "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10";

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isActive
          ? "border-accent bg-accent-soft/30"
          : "border-border bg-bg-elevated hover:border-accent/50"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        {isCustom ? (
          <input
            type="text"
            value={cfg.label}
            onChange={(e) => updateProvider(id, { label: e.target.value })}
            placeholder={t("settings.customNamePlaceholder")}
            className={`${inputCls} flex-1 font-medium`}
          />
        ) : (
          <button
            type="button"
            onClick={() => setActiveProvider(id)}
            className="flex flex-1 items-center justify-between text-left"
          >
            <span className="font-medium text-text-primary">
              {cfg.label}
              {cfg.apiKey == null || cfg.apiKey.trim() === "" ? (
                <span className="ml-1 text-xs text-red-500">
                  {t("settings.missingApiKey")}
                </span>
              ) : null}
            </span>
          </button>
        )}
        {isActive ? (
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-white">
            {t("settings.inUse")}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setActiveProvider(id)}
            className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary transition hover:border-accent/50 hover:text-text-primary"
          >
            {t("settings.useModel")}
          </button>
        )}
        {isCustom && (
          <button
            type="button"
            aria-label={t("settings.removeCustomModel")}
            onClick={() => {
              if (window.confirm(t("settings.removeCustomConfirm"))) {
                removeCustomProvider(id as CustomProviderId);
              }
            }}
            className="shrink-0 rounded-md p-1.5 text-text-secondary transition hover:bg-red-500/10 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
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
            onChange={(e) => updateProvider(id, { baseUrl: e.target.value })}
            placeholder={
              isCustom ? t("settings.customBaseUrlPlaceholder") : undefined
            }
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-muted">
            {t("settings.modelName")}
          </label>
          <input
            type="text"
            value={cfg.model}
            onChange={(e) => updateProvider(id, { model: e.target.value })}
            placeholder={
              isCustom ? t("settings.customModelPlaceholder") : undefined
            }
            className={inputCls}
          />
        </div>
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-xs text-text-muted">API Key</label>
        <input
          type="password"
          value={cfg.apiKey}
          onChange={(e) => updateProvider(id, { apiKey: e.target.value })}
          placeholder="sk-..."
          className={inputCls}
        />
      </div>
    </div>
  );
}
