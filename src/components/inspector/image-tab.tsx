import { useState, useRef } from "react";
import { ImageIcon, Trash2 } from "lucide-react";
import type { Slide, ImageSource } from "@/types/deck";

const POSITION_OPTIONS: { value: string; label: string }[] = [
  { value: "full", label: "全幅" },
  { value: "right", label: "右侧" },
  { value: "background", label: "背景" },
];

interface Props {
  slide: Slide;
  onUpdate: (patch: Partial<Slide>) => void;
  onGenerateImage?: (slideId: string) => void;
}

export function ImageTab({ slide, onUpdate, onGenerateImage }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const urlTimer = useRef<ReturnType<typeof setTimeout>>();

  const image = slide.image;

  if (!image) {
    return (
      <div className="p-3 text-center text-sm text-text-muted">
        当前页面没有配图。
        {onGenerateImage && (
          <button
            onClick={() => onGenerateImage(slide.id)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ai/30 px-3 py-2 text-xs text-ai hover:bg-ai-soft"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            AI 生成配图
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="mb-1 block text-xs text-text-muted">图片来源</label>
        <select
          value={image.type}
          onChange={(e) =>
            onUpdate({
              image: { ...image, type: e.target.value as ImageSource },
            })
          }
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        >
          <option value="url">URL</option>
          <option value="ai">AI 生成</option>
          <option value="icon">图标</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-muted">图片 URL</label>
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
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
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
        <label className="mb-1 block text-xs text-text-muted">替代文本</label>
        <input
          value={image.alt}
          onChange={(e) =>
            onUpdate({ image: { ...image, alt: e.target.value } })
          }
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-muted">位置</label>
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
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        >
          {POSITION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {confirmDelete ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-danger">确定删除配图？</span>
          <button
            onClick={() => {
              onUpdate({ image: undefined });
              setConfirmDelete(false);
            }}
            className="rounded-lg bg-danger px-3 py-1.5 text-xs text-white hover:bg-danger/90"
          >
            确认
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-danger/20 px-3 py-1.5 text-xs text-danger hover:bg-danger/5"
        >
          <Trash2 className="h-3 w-3" />
          删除配图
        </button>
      )}
    </div>
  );
}
