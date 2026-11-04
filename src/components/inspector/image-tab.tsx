import { useEffect, useRef, useState } from "react";
import { Trash2, Search, Upload, Loader2 } from "lucide-react";
import type { Slide, ImageSpec } from "@/types/deck";
import {
  searchWebImages,
  fetchImageAsDataUrl,
  blobToDataUrl,
  MAX_IMAGE_BYTES,
  type WebImage,
} from "@/services/image-search";
import {
  embedImageIntoSvg,
  removeEmbeddedImageFromSvg,
} from "@/engine/svg/embed-image";
import { useSettingsStore } from "@/store/settings";
import { runJob } from "@/store/job";
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
      const found = await runJob(
        {
          type: "image.generate",
          title: t("inspector.imageSearchJob", { query: query.trim() }),
          canCancel: true,
        },
        (job) =>
          searchWebImages(query, {
            pexelsApiKey: useSettingsStore.getState().settings.pexelsApiKey,
            signal: job.signal,
          }),
      );
      setResults(found);
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
          aria-label={t("inspector.imageSearchPlaceholder")}
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
            title={img.attribution}
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
}

export function ImageTab({ slide, onUpdate }: Props) {
  const t = useT();
  const image = slide.image;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [busy, setBusy] = useState<"url" | "upload" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrlDraft(image?.url && !image.url.startsWith("data:") ? image.url : "");
    setError(null);
    setConfirmDelete(false);
  }, [slide.id, image?.url]);

  const applyImage = (spec: ImageSpec, dataUrl: string) => {
    if (slide.svg) {
      if (!/^\s*<svg\b/i.test(slide.svg)) {
        setError(t("inspector.imageEmbedFailed"));
        return;
      }
      onUpdate({
        image: spec,
        svg: embedImageIntoSvg(slide.svg, dataUrl, {
          attribution: spec.attribution,
        }),
        svgStale: slide.svgStale,
      });
    } else {
      onUpdate({ image: spec });
    }
  };

  const handleWebApply = (spec: ImageSpec, dataUrl: string) => {
    setError(null);
    applyImage(spec, dataUrl);
  };

  const handleApplyUrl = async () => {
    const url = urlDraft.trim();
    if (!url || busy) return;
    setBusy("url");
    setError(null);
    try {
      const dataUrl = url.startsWith("data:")
        ? url
        : await fetchImageAsDataUrl(url);
      applyImage(
        {
          type: "url",
          url: dataUrl,
          alt: image?.alt || t("inspector.imageAltFallback"),
          position: image?.position ?? "background",
        },
        dataUrl,
      );
      setUrlDraft("");
    } catch (e) {
      setError(
        t("inspector.imageApplyFailed", { error: (e as Error).message }),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError(t("inspector.imageUploadType"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(t("inspector.imageTooLarge"));
      return;
    }
    setBusy("upload");
    setError(null);
    try {
      const dataUrl = await blobToDataUrl(file);
      applyImage(
        {
          type: "url",
          url: dataUrl,
          alt: image?.alt || file.name || t("inspector.imageAltFallback"),
          position: image?.position ?? "background",
        },
        dataUrl,
      );
    } catch (e) {
      setError(
        t("inspector.imageApplyFailed", { error: (e as Error).message }),
      );
    } finally {
      setBusy(null);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const handleDelete = () => {
    if (slide.svg) {
      onUpdate({
        image: undefined,
        svg: removeEmbeddedImageFromSvg(slide.svg),
        svgStale: slide.svgStale,
      });
    } else {
      onUpdate({ image: undefined });
    }
    setConfirmDelete(false);
  };

  return (
    <div className="space-y-3 p-3 text-sm">
      {image ? (
        <>
          {image.url && (
            <div className="overflow-hidden rounded-lg border border-border">
              <img
                src={image.url}
                alt={image.alt}
                className="h-32 w-full object-cover"
              />
            </div>
          )}

          {image.url?.startsWith("data:") && (
            <p className="text-[10px] text-text-muted">
              {t("inspector.imageEmbedded")}
            </p>
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
              aria-label={t("inspector.imageAlt")}
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
            />
          </div>

          {!slide.svg && (
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
                      position: e.target.value as
                        "full" | "right" | "background",
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
          )}

          {image.attribution && (
            <p className="text-[10px] leading-relaxed text-text-muted">
              © {image.attribution}
            </p>
          )}
        </>
      ) : (
        <div className="text-center text-text-muted">
          {t("inspector.imageEmpty")}
        </div>
      )}

      {slide.svg && (
        <p className="rounded-md bg-bg-surface px-2.5 py-2 text-[10px] leading-relaxed text-text-muted">
          {t("inspector.imageSvgHint")}
        </p>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <label className="block text-xs text-text-muted">
          {t("inspector.imageUrl")}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleApplyUrl();
            }}
            placeholder="https://example.com/image.png"
            aria-label={t("inspector.imageUrl")}
            className="flex-1 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <button
            onClick={() => void handleApplyUrl()}
            disabled={busy !== null || !urlDraft.trim()}
            className="rounded-lg border border-border px-2 py-1.5 text-xs text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {busy === "url"
              ? t("inspector.imageApplying")
              : t("inspector.imageUrlApply")}
          </button>
        </div>
        <p className="text-[10px] text-text-muted">
          {t("inspector.imageUrlHint")}
        </p>

        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          aria-label={t("inspector.imageUpload")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        <button
          onClick={() => uploadRef.current?.click()}
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40"
        >
          {busy === "upload" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("inspector.imageUploading")}
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              {t("inspector.imageUpload")}
            </>
          )}
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="border-t border-border pt-3">
        <p className="mb-2 text-xs text-text-muted">
          {t("inspector.imageSearch")}
        </p>
        <WebImageSearchPanel onApply={handleWebApply} />
      </div>

      {image &&
        (confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-danger">
              {t("inspector.imageDeleteConfirm")}
            </span>
            <button
              onClick={handleDelete}
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
        ))}
    </div>
  );
}
