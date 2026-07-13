import { useState, useEffect, useRef } from "react";
import type { Slide, SlideLayout } from "@/types/deck";

const LAYOUT_OPTIONS: { value: SlideLayout; label: string }[] = [
  { value: "cover", label: "封面" },
  { value: "section", label: "章节" },
  { value: "content", label: "正文" },
  { value: "two-column", label: "双栏" },
  { value: "chart", label: "图表" },
  { value: "image", label: "配图" },
  { value: "closing", label: "结尾" },
  { value: "cols-2", label: "两列" },
  { value: "cols-3", label: "三列" },
  { value: "cols-4", label: "四列" },
  { value: "cols-5", label: "五列" },
  { value: "cols-6", label: "六列" },
];

interface Props {
  slide: Slide;
  onUpdate: (patch: Partial<Slide>) => void;
}

export function SlideTab({ slide, onUpdate }: Props) {
  const [titleDraft, setTitleDraft] = useState(slide.title);
  const [subtitleDraft, setSubtitleDraft] = useState(slide.subtitle ?? "");
  const [bodyDraft, setBodyDraft] = useState(slide.body ?? "");
  const titleTimer = useRef<ReturnType<typeof setTimeout>>();
  const subtitleTimer = useRef<ReturnType<typeof setTimeout>>();
  const bodyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setTitleDraft(slide.title);
    setSubtitleDraft(slide.subtitle ?? "");
    setBodyDraft(slide.body ?? "");
    // 切换页面时清掉上一页未触发的防抖定时器，避免把旧草稿写到新页
    return () => {
      if (titleTimer.current) clearTimeout(titleTimer.current);
      if (subtitleTimer.current) clearTimeout(subtitleTimer.current);
      if (bodyTimer.current) clearTimeout(bodyTimer.current);
    };
  }, [slide.id, slide.title, slide.subtitle, slide.body]);

  const debouncedUpdate = (
    timer: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>,
    patch: Partial<Slide>,
  ) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onUpdate(patch), 300);
  };

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="mb-1 block text-xs text-text-muted">标题</label>
        <input
          value={titleDraft}
          onChange={(e) => {
            setTitleDraft(e.target.value);
            debouncedUpdate(titleTimer, { title: e.target.value });
          }}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-muted">副标题</label>
        <input
          value={subtitleDraft}
          onChange={(e) => {
            setSubtitleDraft(e.target.value);
            debouncedUpdate(subtitleTimer, {
              subtitle: e.target.value || undefined,
            });
          }}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-muted">布局</label>
        <select
          value={slide.layout}
          onChange={(e) => onUpdate({ layout: e.target.value as SlideLayout })}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        >
          {LAYOUT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-muted">正文</label>
        <textarea
          value={bodyDraft}
          onChange={(e) => {
            setBodyDraft(e.target.value);
            debouncedUpdate(bodyTimer, { body: e.target.value || undefined });
          }}
          rows={4}
          className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        />
      </div>

      {slide.bullets && slide.bullets.length > 0 && (
        <div>
          <label className="mb-1 block text-xs text-text-muted">
            要点（{slide.bullets.length}条）
          </label>
          <div className="space-y-1">
            {slide.bullets.map((b, i) => (
              <div
                key={b.id}
                className="rounded-lg bg-bg-surface px-3 py-1.5 text-xs text-text-secondary"
              >
                <span className="mr-1 text-text-muted">{i + 1}.</span>
                {b.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
