import { useEffect, useState } from "react";
import { Download, Trash2, Loader2, Cpu, Square } from "lucide-react";
import { useModelStore, type ModelState } from "@/store/model";
import { MODEL_REGISTRY, formatGB } from "@/services/model-manager";
import type { ModelTier } from "@/services/model-manager";
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
    if (progress?.phase === "verifying") return <>{t("model.verifying")}</>;
    if (state === "loading") return <>{t("model.loading")}</>;
    const percent =
      progress && progress.total
        ? Math.min(99, Math.round((progress.downloaded / progress.total) * 100))
        : 0;
    return <>{t("model.downloading", { percent })}</>;
  }
  if (state === "error")
    return <>{t("model.error", { message: error ?? "" })}</>;
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
  const cancelDownload = useModelStore((s) => s.cancelDownload);
  const load = useModelStore((s) => s.load);
  const unload = useModelStore((s) => s.unload);
  const remove = useModelStore((s) => s.remove);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const def = MODEL_REGISTRY[tier];
  const busy = state === "downloading" || state === "loading";

  // 删除模型文件的两步确认（体积大，误删需重新下载）
  const deleteControl = confirmDelete ? (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="text-danger">{t("model.deleteConfirm")}</span>
      <button
        type="button"
        onClick={() => {
          setConfirmDelete(false);
          void remove();
        }}
        className="rounded bg-danger px-2 py-0.5 text-white transition hover:bg-danger/90"
      >
        {t("common.confirm")}
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(false)}
        className="rounded px-1.5 py-0.5 text-text-muted transition hover:text-text-primary"
      >
        {t("common.cancel")}
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setConfirmDelete(true)}
      className={`flex items-center gap-1 ${btnCls}`}
    >
      <Trash2 className="h-4 w-4" />
      {t("model.delete")}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Cpu className="h-4 w-4 text-accent" />
        <span>
          <ModelStatusText t={t} />
        </span>
      </div>
      {(state === "downloading" || state === "loading") && (
        <div className="flex items-center gap-2">
          <ProgressBar />
          {state === "downloading" && (
            <button
              type="button"
              onClick={() => void cancelDownload()}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-secondary transition hover:border-danger/50 hover:text-danger"
              title={t("model.cancelDownload")}
            >
              <Square className="h-3 w-3" />
              {t("model.cancelDownload")}
            </button>
          )}
        </div>
      )}

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
            {deleteControl}
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
            {deleteControl}
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
