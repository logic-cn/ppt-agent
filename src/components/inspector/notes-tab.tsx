import { useState, useEffect, useRef } from "react";
import type { Slide } from "@/types/deck";
import { useT } from "@/hooks/use-page-t";

interface Props {
  slide: Slide;
  onUpdate: (patch: Partial<Slide>) => void;
}

export function NotesTab({ slide, onUpdate }: Props) {
  const t = useT();
  const [draft, setDraft] = useState(slide.notes ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setDraft(slide.notes ?? "");
  }, [slide.id, slide.notes]);

  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-text-muted">{t("inspector.notesHint")}</p>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            onUpdate({ notes: e.target.value || undefined });
          }, 300);
        }}
        placeholder={t("inspector.notesPlaceholder")}
        rows={12}
        className="w-full resize-none rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
      />
    </div>
  );
}
