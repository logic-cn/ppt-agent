import { useState, useRef } from "react";
import { ImageIcon, Trash2, Search } from "lucide-react";
import type { Slide, ImageSource, ImageSpec } from "@/types/deck";
import {
  searchWebImages,
  fetchImageAsDataUrl,
  type WebImage,
} from "@/services/image-search";
import { embedImageIntoSvg } from "@/engine/svg/embed-image";
import { useSettingsStore } from "@/store/settings";
import { useT } from "@/hooks/use-page-t";
import type { TranslationKey } from "@/services/i18n";

const POSITION_OPTIONS: { value: string; label: TranslationKey }[] = [
  { value: "full", label: "inspector.imageFull" },
  { value: "right", label: "inspector.imageRight" },
  { value: "background", label: "inspector.imageBackground" },
];

/** 网络搜图区（B7）：Openverse 零配置源，选中后内嵌为 data URL 底图 */
function WebImageSearchPanel({
  onApply,
}: {
  onApply: (image: ImageSpec, dataUrl: string) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WebImage[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setError(null);
    try {
      setResults(
        await searchWebImages(query, {
          pexelsApiKey: useSettingsStore.getState().settings.pexelsApiKey,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const handleApply = async (img: WebImage) => {
    if (applying) return;
    setApplying(img.url);
    setError(null);
    try {
      const dataUrl = await fetchImageAsDataUrl(img.url);
      onApply(
        {
          type: "web",
          url: dataUrl,
          alt: query || img.source,
          position: "background",
          attribution: img.attribution,
        },
        dataUrl,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSearch();
          }}
          placeholder={t("inspector.imageSearchPlaceholder")}
          className="flex-1 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <button
          onClick={() => void handleSearch()}
          disabled={searching || !query.trim()}
          className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40"
        >
          <Search className="h-3 w-3" />
          {t("inspector.imageSearch")}
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {searched && !searching && results.length === 0 && !error && (
        <p className="text-xs text-text-muted">
          {t("inspector.imageSearchEmpty")}
        </p>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {results.map((img) => (
          <button
            key={img.url}
            onClick={() => void handleApply(img)}
            disabled={applying !== null}
            title={`${img.attribution}（点击使用）`}
            className="group relative aspect-video overflow-hidden rounded-md border border-border hover:border-accent disabled:opacity-50"
          >
            <img
              src={img.thumb}
              alt={img.source}
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              {img.license} · {applying === img.url ? "…" : img.source}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  slide: Slide;
  onUpdate: (patch: Partial<Slide>) => void;
  onGenerateImage?: (slideId: string) => void;
}

export function ImageTab({ slide, onUpdate, onGenerateImage }: Props) {
  const t = useT();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const urlTimer = useRef<ReturnType<typeof setTimeout>>();

  const image = slide.image;

  const handleWebApply = (img: ImageSpec, dataUrl: string) => {
    if (slide.svg) {
      // X1 页面：确定性嵌入为底层画面 + 遮罩（不经 LLM，走 undo 历史）
      onUpdate({
        image: img,
        svg: embedImageIntoSvg(slide.svg, dataUrl, {
          attribution: img.attribution,
        }),
      });
    } else {
      onUpdate({ image: img });
    }
  };

  if (!image) {
    return (
      <div className="space-y-3 p-3 text-sm text-text-muted">
        <div className="text-center">{t("inspector.imageEmpty")}</div>
        {onGenerateImage && (
          <button
            onClick={() => onGenerateImage(slide.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ai/30 px-3 py-2 text-xs text-ai hover:bg-ai-soft"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            {t("inspector.imageGenerate")}
          </button>
        )}
        <WebImageSearchPanel onApply={handleWebApply} />
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="mb-1 block text-xs text-text-muted">
          {t("inspector.imageSource")}
        </label>
        <select
          value={image.type}
          onChange={(e) =>
            onUpdate({
              image: { ...image, type: e.target.value as ImageSource },
            })
          }
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        >
          <option value="url">URL</option>
          <option value="ai">{t("inspector.imageSourceAi")}</option>
          <option value="icon">{t("inspector.imageSourceIcon")}</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-muted">
          {t("inspector.imageUrl")}
        </label>
        <input
          value={image.url ?? ""}
          onChange={(e) => {
            const url = e.target.value;
            if (urlTimer.current) clearTimeout(urlTimer.current);
            urlTimer.current = setTimeout(() => {
              onUpdate({ image: { ...image, url: url || undefined } });
            }, 300);
          }}
          placeholder="https://example.com/image.png"
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        />
      </div>

      {image.url && (
        <div className="overflow-hidden rounded-lg border border-border">
          <img
            src={image.url}
            alt={image.alt}
            className="h-32 w-full object-cover"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-text-muted">
          {t("inspector.imageAlt")}
        </label>
        <input
          value={image.alt}
          onChange={(e) =>
            onUpdate({ image: { ...image, alt: e.target.value } })
          }
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-muted">
          {t("inspector.imagePosition")}
        </label>
        <select
          value={image.position ?? "full"}
          onChange={(e) =>
            onUpdate({
              image: {
                ...image,
                position: e.target.value as "full" | "right" | "background",
              },
            })
          }
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        >
          {POSITION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.label)}
            </option>
          ))}
        </select>
      </div>

      {image.attribution && (
        <p className="text-[10px] leading-relaxed text-text-muted">
          © {image.attribution}
        </p>
      )}

      <WebImageSearchPanel onApply={handleWebApply} />

      {confirmDelete ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-danger">
            {t("inspector.imageDeleteConfirm")}
          </span>
          <button
            onClick={() => {
              onUpdate({ image: undefined });
              setConfirmDelete(false);
            }}
            className="rounded-lg bg-danger px-3 py-1.5 text-xs text-white hover:bg-danger/90"
          >
            {t("common.confirm")}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-danger/20 px-3 py-1.5 text-xs text-danger hover:bg-danger/5"
        >
          <Trash2 className="h-3 w-3" />
          {t("inspector.imageDelete")}
        </button>
      )}
    </div>
  );
}
