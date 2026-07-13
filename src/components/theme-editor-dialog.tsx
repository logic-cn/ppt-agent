import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Theme } from "@/types/theme";
import type { Spacing } from "@/types/theme";

interface Props {
  theme: Theme;
  onSave: (theme: Theme) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const COLOR_LABELS: { key: keyof Theme["colors"]; label: string }[] = [
  { key: "primary", label: "主色" },
  { key: "secondary", label: "辅色" },
  { key: "accent", label: "强调色" },
  { key: "background", label: "背景色" },
  { key: "surface", label: "卡片背景" },
  { key: "text", label: "正文颜色" },
  { key: "textMuted", label: "次要文字" },
];

const SPACING_OPTIONS: { value: Spacing; label: string }[] = [
  { value: "compact", label: "紧凑" },
  { value: "comfortable", label: "舒适" },
  { value: "airy", label: "宽松" },
];

export function ThemeEditorDialog({ theme, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(theme.name);
  const [colors, setColors] = useState({ ...theme.colors });
  const [fonts, setFonts] = useState({ ...theme.fonts });
  const [fontSize, setFontSize] = useState({ ...theme.fontSize });
  const [spacing, setSpacing] = useState(theme.spacing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const buildTheme = (): Theme => ({
    ...theme,
    name,
    colors,
    fonts: {
      title: fonts.title || "sans-serif",
      body: fonts.body || "sans-serif",
    },
    fontSize: {
      h1: fontSize.h1 || 44,
      h2: fontSize.h2 || 32,
      body: fontSize.body || 18,
      caption: fontSize.caption || 14,
    },
    spacing,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(buildTheme());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const current = buildTheme();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-editor-title"
    >
      <div
        className="mx-4 flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="theme-editor-title" className="text-base font-semibold">
            {theme.id.startsWith("custom-")
              ? "编辑自定义主题"
              : "新建自定义主题"}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-bg-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 gap-6 overflow-auto p-5">
          {/* 左侧：表单 */}
          <div className="w-[420px] shrink-0 space-y-5">
            {/* 主题名称 */}
            <div>
              <label className="mb-1 block text-sm text-text-secondary">
                主题名称
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                placeholder="我的自定义主题"
              />
            </div>

            {/* 颜色配置 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text-secondary">
                颜色
              </label>
              <div className="grid grid-cols-2 gap-3">
                {COLOR_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors[key]}
                      onChange={(e) =>
                        setColors((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="h-7 w-7 cursor-pointer rounded border border-border bg-transparent p-0.5"
                    />
                    <span className="text-xs text-text-secondary">{label}</span>
                    <input
                      type="text"
                      value={colors[key]}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        // 仅接受合法 hex（#rgb / #rrggbb），避免污染主题色
                        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
                          setColors((prev) => ({ ...prev, [key]: v }));
                        }
                      }}
                      className="ml-auto w-20 rounded border border-border bg-white px-1.5 py-0.5 text-xs text-text-primary focus:border-accent focus:outline-none font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 字体 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-text-secondary">
                  标题字体
                </label>
                <input
                  type="text"
                  value={fonts.title}
                  onChange={(e) =>
                    setFonts((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                  placeholder="sans-serif"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-secondary">
                  正文字体
                </label>
                <input
                  type="text"
                  value={fonts.body}
                  onChange={(e) =>
                    setFonts((prev) => ({ ...prev, body: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                  placeholder="sans-serif"
                />
              </div>
            </div>

            {/* 字号 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text-secondary">
                字号 (pt)
              </label>
              <div className="grid grid-cols-4 gap-3">
                {(
                  [
                    { key: "h1" as const, label: "标题1" },
                    { key: "h2" as const, label: "标题2" },
                    { key: "body" as const, label: "正文" },
                    { key: "caption" as const, label: "注释" },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs text-text-muted">
                      {label}
                    </label>
                    <input
                      type="number"
                      value={fontSize[key]}
                      onChange={(e) =>
                        setFontSize((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                      min={8}
                      max={96}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 间距 */}
            <div>
              <label className="mb-1 block text-sm text-text-secondary">
                间距
              </label>
              <div className="flex gap-2">
                {SPACING_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setSpacing(value)}
                    className={`rounded-lg border px-4 py-1.5 text-sm transition ${
                      spacing === value
                        ? "border-accent bg-accent-soft/40 text-accent"
                        : "border-border text-text-secondary hover:bg-bg-hover"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧：预览 */}
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-bg-base p-4">
            <div className="text-sm text-text-muted">实时预览</div>
            <div className="mt-2 w-full max-w-sm overflow-hidden rounded-lg shadow-md">
              <div
                className="relative"
                style={{
                  background: current.colors.background,
                  aspectRatio: "16 / 9",
                  width: "100%",
                }}
              >
                {/* 装饰条 */}
                <div
                  className="absolute left-0 top-0 h-full w-[6px]"
                  style={{ background: current.colors.primary }}
                />
                {/* 标题 */}
                <div
                  className="absolute px-5"
                  style={{
                    top: "20%",
                    left: "6%",
                    color: current.colors.primary,
                    fontFamily: current.fonts.title,
                    fontSize: `${current.fontSize.h1 * 0.5}px`,
                    fontWeight: 700,
                  }}
                >
                  标题文字示例
                </div>
                {/* 正文 */}
                <div
                  className="absolute px-5"
                  style={{
                    top: "45%",
                    left: "6%",
                    width: "88%",
                    color: current.colors.text,
                    fontFamily: current.fonts.body,
                    fontSize: `${current.fontSize.body * 0.45}px`,
                    lineHeight: 1.5,
                  }}
                >
                  <div>这是正文示例文字，展示了主题配色效果。</div>
                  <div
                    className="mt-2"
                    style={{
                      color: current.colors.textMuted,
                      fontSize: `${current.fontSize.body * 0.35}px`,
                    }}
                  >
                    次要文字 / 注释风格
                  </div>
                </div>
                {/* 色块 */}
                <div
                  className="absolute flex gap-1.5"
                  style={{ bottom: "10%", left: "6%" }}
                >
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ background: current.colors.accent }}
                  />
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ background: current.colors.secondary }}
                  />
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{
                      background: current.colors.surface,
                      border: "1px solid rgba(0,0,0,0.1)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 颜色小标签 */}
            <div className="mt-3 flex flex-wrap gap-2">
              {COLOR_LABELS.slice(0, 5).map(({ key, label }) => (
                <span
                  key={key}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
                  style={{
                    background: current.colors[key],
                    color: current.colors.background,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div>
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md px-4 py-1.5 text-sm text-red-400 hover:bg-red-100/10 disabled:opacity-50"
              >
                {deleting ? "删除中…" : "删除主题"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border px-4 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="rounded-lg bg-gradient-to-r from-accent to-purple-500 px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
