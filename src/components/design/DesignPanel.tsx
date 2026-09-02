import type {
  DesignLock,
  NarrativeModeId,
  VisualStyleId,
} from "@/types/design";
import { NARRATIVE_MODE_IDS, VISUAL_STYLE_IDS } from "@/types/design";
import { PalettePicker } from "./PalettePicker";

const MODE_LABELS: Record<NarrativeModeId, string> = {
  pyramid: "金字塔",
  narrative: "叙事",
  instructional: "教学",
  showcase: "展示",
  briefing: "简报",
  custom: "自定义",
};

const STYLE_LABELS: Record<VisualStyleId, string> = {
  "swiss-minimal": "瑞士极简",
  "dark-tech": "暗色科技",
  "soft-rounded": "柔和圆角",
  editorial: "编辑排版",
  blueprint: "蓝图纸感",
  glassmorphism: "玻璃拟态",
};

interface Props {
  design: DesignLock;
  onChange: (next: DesignLock) => void;
}

export function DesignPanel({ design, onChange }: Props) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-xs font-medium text-text-muted dark:text-text-primary">
          模式
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {NARRATIVE_MODE_IDS.map((id) => {
            const selected = id === design.mode;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ ...design, mode: id })}
                aria-pressed={selected}
                className={[
                  "rounded-md px-2.5 py-1.5 text-sm transition",
                  selected
                    ? "bg-accent text-white"
                    : "bg-bg-surface text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                ].join(" ")}
              >
                {MODE_LABELS[id]}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium text-text-muted">视觉风格</h3>
        <div className="flex flex-wrap gap-1.5">
          {VISUAL_STYLE_IDS.map((id) => {
            const selected = id === design.visualStyle;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ ...design, visualStyle: id })}
                aria-pressed={selected}
                className={[
                  "rounded-full border px-2.5 py-1.5 text-sm transition",
                  selected
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-bg-surface text-text-secondary hover:border-accent hover:bg-bg-hover",
                ].join(" ")}
              >
                {STYLE_LABELS[id]}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium text-text-muted">配色</h3>
        <PalettePicker
          value={design.palette}
          onChange={(id) => onChange({ ...design, palette: id })}
        />
      </section>
    </div>
  );
}
