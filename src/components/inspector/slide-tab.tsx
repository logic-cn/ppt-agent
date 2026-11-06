import { useState, useEffect, useRef } from "react";
import type { Slide, SlideLayout } from "@/types/deck";
import { useT } from "@/hooks/use-page-t";
import type { TranslationKey } from "@/services/i18n";

const LAYOUT_OPTIONS: { value: SlideLayout; label: TranslationKey }[] = [
  { value: "cover", label: "inspector.layoutCover" },
  { value: "section", label: "inspector.layoutSection" },
  { value: "content", label: "inspector.layoutContent" },
  { value: "two-column", label: "inspector.layoutTwoColumn" },
  { value: "chart", label: "inspector.layoutChart" },
  { value: "image", label: "inspector.layoutImage" },
  { value: "closing", label: "inspector.layoutClosing" },
  { value: "cols-2", label: "inspector.layoutCols2" },
  { value: "cols-3", label: "inspector.layoutCols3" },
  { value: "cols-4", label: "inspector.layoutCols4" },
  { value: "cols-5", label: "inspector.layoutCols5" },
  { value: "cols-6", label: "inspector.layoutCols6" },
];

interface Props {
  slide: Slide;
  onUpdate: (patch: Partial<Slide>) => void;
}

export function SlideTab({ slide, onUpdate }: Props) {
  const t = useT();
  const [titleDraft, setTitleDraft] = useState(slide.title);
  const [subtitleDraft, setSubtitleDraft] = useState(slide.subtitle ?? "");
  const [bodyDraft, setBodyDraft] = useState(slide.body ?? "");
  const titleTimer = useRef<ReturnType<typeof setTimeout>>();
  const subtitleTimer = useRef<ReturnType<typeof setTimeout>>();
  const bodyTimer = useRef<ReturnType<typeof setTimeout>>();
  // 本组件最后一次落盘的字段值：区分「自身 debounce 回显」与「外部改动」
  const lastCommitted = useRef<{
    id: string;
    title: string;
    subtitle: string;
    body: string;
  }>({
    id: slide.id,
    title: slide.title,
    subtitle: slide.subtitle ?? "",
    body: slide.body ?? "",
  });

  useEffect(() => {
    const incoming = {
      title: slide.title,
      subtitle: slide.subtitle ?? "",
      body: slide.body ?? "",
    };
    // 外部改动（AI patch / 重画 / 撤销）才重置草稿；自身落盘的回显
    // 不打断输入（否则 AI patch 应用瞬间正被覆盖字段的草稿会被清掉）
    const last = lastCommitted.current;
    if (
      slide.id !== last.id ||
      incoming.title !== last.title ||
      incoming.subtitle !== last.subtitle ||
      incoming.body !== last.body
    ) {
      setTitleDraft(incoming.title);
      setSubtitleDraft(incoming.subtitle);
      setBodyDraft(incoming.body);
      lastCommitted.current = { ...incoming, id: slide.id };
    }
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
    timer.current = setTimeout(() => {
      lastCommitted.current = {
        id: slide.id,
        title: patch.title ?? lastCommitted.current.title,
        subtitle:
          patch.subtitle !== undefined
            ? patch.subtitle
            : lastCommitted.current.subtitle,
        body:
          patch.body !== undefined ? patch.body : lastCommitted.current.body,
      };
      onUpdate(patch);
    }, 300);
  };

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="mb-1 block text-xs text-text-muted">
          {t("inspector.title")}
        </label>
        <input
          value={titleDraft}
          onChange={(e) => {
            setTitleDraft(e.target.value);
            debouncedUpdate(titleTimer, { title: e.target.value });
          }}
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-muted">
          {t("inspector.subtitle")}
        </label>
        <input
          value={subtitleDraft}
          onChange={(e) => {
            setSubtitleDraft(e.target.value);
            debouncedUpdate(subtitleTimer, {
              subtitle: e.target.value || undefined,
            });
          }}
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-muted">
          {t("inspector.layout")}
        </label>
        <select
          value={slide.layout}
          onChange={(e) => onUpdate({ layout: e.target.value as SlideLayout })}
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        >
          {LAYOUT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.label)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-muted">
          {t("inspector.body")}
        </label>
        <textarea
          value={bodyDraft}
          onChange={(e) => {
            setBodyDraft(e.target.value);
            debouncedUpdate(bodyTimer, { body: e.target.value || undefined });
          }}
          rows={4}
          className="w-full resize-none rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
        />
      </div>

      {slide.bullets && slide.bullets.length > 0 && (
        <div>
          <label className="mb-1 block text-xs text-text-muted">
            {t("inspector.bullets", { count: slide.bullets.length })}
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
