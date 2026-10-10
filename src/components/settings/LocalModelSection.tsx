import { useEffect } from "react";
import { Download, Trash2, Loader2, Cpu, ExternalLink } from "lucide-react";
import { useModelStore, type ModelState } from "@/store/model";
import { useSettingsStore } from "@/store/settings";
import { MODEL_REGISTRY, formatGB, isTauriRuntime } from "@/services/model-manager";
import type { ModelTier } from "@/services/model-manager";
import { isLocalProviderConfig } from "@/types/llm";
import { useT } from "@/hooks/use-page-t";
import type { TranslationKey } from "@/locales/en";

const STATUS_KEY: Record<ModelState, TranslationKey | null> = {
  unknown: null,
  unsupported: "model.unsupported",
  absent: "model.absent",
  downloading: "model.downloading",
  downloaded: "model.downloaded",
  loading: "model.loading",
  loaded: "model.loaded",
  error: "model.error",
};

export function ModelStatusText({ t }: { t: ReturnType<typeof useT> }) {
  const state = useModelStore((s) => s.state);
  const progress = useModelStore((s) => s.progress);
  const error = useModelStore((s) => s.error);

  if (state === "downloading" || state === "loading") {
    if (progress?.phase === "verifying")
      return <>{t("model.verifying")}</>;
    if (state === "loading") return <>{t("model.loading")}</>;
    const percent =
      progress && progress.total
        ? Math.min(99, Math.round((progress.downloaded / progress.total) * 100))
        : 0;
    return <>{t("model.downloading", { percent })}</>;
  }
  if (state === "error") return <>{t("model.error", { message: error ?? "" })}</>;
  const key = STATUS_KEY[state];
  return <>{key ? t(key) : ""}</>;
}

function ProgressBar() {
  const progress = useModelStore((s) => s.progress);
  if (!progress || !progress.total) return null;
  const pct = Math.min(
    100,
    Math.round((progress.downloaded / progress.total) * 100),
  );
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-surface">
      <div
        className="h-full rounded-full bg-accent transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const btnCls =
  "rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary transition hover:border-accent/50 hover:text-text-primary";

/**
 * 本地模型管理区块：档位选择 + 状态 + 下载/加载/卸载/删除。
 * 嵌入设置页 provider 卡片与首页生成入口卡片两处复用。
 */
export function LocalModelSection({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const state = useModelStore((s) => s.state);
  const tier = useModelStore((s) => s.tier);
  const refresh = useModelStore((s) => s.refresh);
  const setTier = useModelStore((s) => s.setTier);
  const download = useModelStore((s) => s.download);
  const load = useModelStore((s) => s.load);
  const unload = useModelStore((s) => s.unload);
  const remove = useModelStore((s) => s.remove);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const def = MODEL_REGISTRY[tier];
  const busy = state === "downloading" || state === "loading";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Cpu className="h-4 w-4 text-accent" />
        <span>
          <ModelStatusText t={t} />
        </span>
      </div>
      {(state === "downloading" || state === "loading") && <ProgressBar />}

      {!compact && state !== "unsupported" && (
        <div>
          <label className="mb-1 block text-xs text-text-muted">
            {t("model.tier")}
          </label>
          <div className="flex flex-col gap-1.5 sm:flex-row">
            {(["standard", "light"] as ModelTier[]).map((id) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => void setTier(id)}
                className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
                  tier === id
                    ? "border-accent bg-accent-soft/30 text-text-primary"
                    : "border-border text-text-secondary hover:border-accent/50"
                }`}
              >
                {t(
                  id === "standard" ? "model.tierStandard" : "model.tierLight",
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {state === "absent" && (
          <button
            type="button"
            onClick={() => void download()}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            {t("model.download")}
            <span className="text-xs opacity-75">
              {formatGB(def.sizeBytes)}
            </span>
          </button>
        )}
        {state === "downloaded" && (
          <>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition hover:opacity-90"
            >
              {t("model.load")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("model.deleteConfirm")))
                  void remove();
              }}
              className={`flex items-center gap-1 ${btnCls}`}
            >
              <Trash2 className="h-4 w-4" />
              {t("model.delete")}
            </button>
          </>
        )}
        {state === "loaded" && (
          <>
            <button
              type="button"
              onClick={() => void unload()}
              className={btnCls}
            >
              {t("model.unload")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("model.deleteConfirm"))) void remove();
              }}
              className={`flex items-center gap-1 ${btnCls}`}
            >
              <Trash2 className="h-4 w-4" />
              {t("model.delete")}
            </button>
          </>
        )}
        {state === "error" && (
          <button
            type="button"
            onClick={() => void download()}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            {t("model.download")}
          </button>
        )}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
      </div>
    </div>
  );
}

/**
 * 生成入口的模型门控卡片：仅当激活 provider 为本地模型且未就绪时显示。
 * 「准备就绪」为单按钮流：下载 → 校验 → 加载，进度实时展示。
 */
export function ModelGateCard() {
  const t = useT();
  const activeProvider = useSettingsStore((s) => s.settings.activeProvider);
  const providers = useSettingsStore((s) => s.settings.providers);
  const setActiveProvider = useSettingsStore((s) => s.setActiveProvider);
  const state = useModelStore((s) => s.state);
  const tier = useModelStore((s) => s.tier);
  const refresh = useModelStore((s) => s.refresh);
  const ensureReady = useModelStore((s) => s.ensureReady);
  const download = useModelStore((s) => s.download);

  const cfg = providers[activeProvider];
  const localActive = !!cfg && isLocalProviderConfig(cfg);

  useEffect(() => {
    if (localActive && state === "unknown") void refresh();
  }, [localActive, state, refresh]);

  if (!localActive) return null;
  if (state === "loaded" || state === "unknown") return null;

  const def = MODEL_REGISTRY[tier];
  const busy = state === "downloading" || state === "loading";

  if (state === "unsupported" || !isTauriRuntime()) {
    return (
      <div className="mx-3 mb-2 rounded-xl border border-border bg-bg-elevated p-3 text-sm">
        <div className="flex items-center gap-2 text-text-secondary">
          <Cpu className="h-4 w-4 text-accent" />
          {t("model.unsupported")}
        </div>
        <button
          type="button"
          onClick={() => setActiveProvider("deepseek")}
          className="mt-2 flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {t("model.gateSwitch")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-2 rounded-xl border border-accent/40 bg-accent-soft/20 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <Cpu className="h-4 w-4 text-accent" />
        {state === "absent" || state === "error"
          ? t("model.gateTitle")
          : t("model.downloaded")}
      </div>
      {(state === "absent" || state === "error") && (
        <p className="mt-1 text-xs text-text-muted">
          {t("model.gateDesc", { size: formatGB(def.sizeBytes) })}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
        <ModelStatusText t={t} />
      </div>
      {busy && (
        <div className="mt-2">
          <ProgressBar />
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        {!busy && (
          <button
            type="button"
            onClick={() => void (state === "downloaded" ? ensureReady().catch(() => {}) : download())}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            {state === "downloaded" ? t("model.load") : t("model.download")}
          </button>
        )}
        {state === "loading" && (
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
        )}
        <button
          type="button"
          onClick={() => setActiveProvider("deepseek")}
          className="text-xs text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
        >
          {t("model.gateSwitch")}
        </button>
      </div>
      {state === "error" && (
        <button
          type="button"
          onClick={() => void download()}
          className="mt-1 text-xs text-accent hover:underline"
        >
          {t("model.download")}
        </button>
      )}
    </div>
  );
}
