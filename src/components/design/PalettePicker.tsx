import { useState } from "react";
import type { PaletteId } from "@/types/design";
import { getPalettes } from "@/design/palettes";
import type { ThemeColors } from "@/design/palettes";
import { useCustomPalettes } from "@/store/custom-palettes";
import { useT } from "@/hooks/use-page-t";
import type { TranslationKey } from "@/services/i18n";

interface Props {
  value: PaletteId;
  onChange: (id: PaletteId) => void;
}

const COLOR_FIELDS: { key: keyof ThemeColors; label: TranslationKey }[] = [
  { key: "primary", label: "design.colorPrimary" },
  { key: "secondary", label: "design.colorSecondary" },
  { key: "accent", label: "design.colorAccent" },
  { key: "background", label: "design.colorBackground" },
  { key: "surface", label: "design.colorSurface" },
  { key: "text", label: "design.colorText" },
  { key: "textMuted", label: "design.colorTextMuted" },
];

const DEFAULT_COLORS: ThemeColors = {
  primary: "#2563EB",
  secondary: "#3B82F6",
  accent: "#FBBF24",
  background: "#0C1929",
  surface: "#1A2D42",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
};

export function PalettePicker({ value, onChange }: Props) {
  const t = useT();
  const customPalettes = useCustomPalettes((s) => s.palettes);
  const palettes = [
    ...getPalettes().filter((p) => !p.id.startsWith("custom-")),
    ...customPalettes,
  ];
  const create = useCustomPalettes((s) => s.create);
  const remove = useCustomPalettes((s) => s.remove);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [colors, setColors] = useState<ThemeColors>(DEFAULT_COLORS);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const p = await create(name.trim(), colors);
    onChange(p.id);
    setCreating(false);
    setName("");
    setColors(DEFAULT_COLORS);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {palettes.map((palette) => {
          const selected = palette.id === value;
          const isCustom = palette.id.startsWith("custom-");
          return (
            <button
              key={palette.id}
              type="button"
              onClick={() => onChange(palette.id)}
              aria-pressed={selected}
              className={[
                "relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition",
                selected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-bg-surface hover:border-accent hover:bg-bg-hover",
              ].join(" ")}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="h-3.5 w-3.5 rounded-full border border-border"
                  style={{ backgroundColor: palette.colors.primary }}
                />
                <span
                  className="h-3.5 w-3.5 rounded-full border border-border"
                  style={{ backgroundColor: palette.colors.accent }}
                />
                <span
                  className="h-3.5 w-3.5 rounded-full border border-border"
                  style={{ backgroundColor: palette.colors.background }}
                />
              </span>
              <span className="text-sm font-medium text-text-primary">
                {isCustom
                  ? palette.name
                  : t(`palette.${palette.id}` as TranslationKey)}
              </span>
              {isCustom && (
                <button
                  type="button"
                  aria-label={t("design.deletePalette", { name: palette.name })}
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(palette.id);
                  }}
                  className="absolute right-1.5 top-1.5 text-xs text-text-muted hover:text-accent"
                >
                  ✕
                </button>
              )}
            </button>
          );
        })}
      </div>

      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="self-start rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-text-muted transition hover:border-accent hover:text-accent"
        >
          {t("design.newPalette")}
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-surface p-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("design.paletteName")}
            className="w-full rounded-md border border-border bg-bg px-2 py-1 text-sm text-text-primary outline-none focus:border-accent"
          />
          <div className="flex flex-wrap gap-3">
            {COLOR_FIELDS.map((field) => (
              <label
                key={field.key}
                className="flex flex-col items-center gap-1 text-xs text-text-muted"
              >
                <input
                  type="color"
                  value={colors[field.key]}
                  onChange={(e) =>
                    setColors((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={t(field.label)}
                  className="h-8 w-10 cursor-pointer rounded border border-border"
                />
                {t(field.label)}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg transition hover:opacity-90"
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setName("");
                setColors(DEFAULT_COLORS);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text-muted transition hover:border-accent"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
