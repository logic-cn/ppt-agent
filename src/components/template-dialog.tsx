import { useCallback, useEffect } from "react";
import { FileText, X } from "lucide-react";
import type { Template } from "@/templates";
import { BUILTIN_TEMPLATES } from "@/templates";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (template: Template) => void;
}

export function TemplateDialog({ open, onClose, onSelect }: Props) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-dialog-title"
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="template-dialog-title" className="text-base font-semibold">
            从模板创建
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-bg-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5">
          {BUILTIN_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="group flex flex-col items-start gap-2 rounded-lg border border-border p-4 text-left transition hover:border-accent hover:bg-bg-elevated"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft/50 group-hover:bg-accent-soft">
                <FileText className="h-5 w-5 text-accent" />
              </div>
              <div>
                <div className="font-medium text-text-primary group-hover:text-accent">
                  {t.name}
                </div>
                <div className="mt-0.5 text-sm text-text-muted">
                  {t.description}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  {t.suggestedPageCount} 页
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="border-t border-border px-5 py-3 text-xs text-text-muted">
          选择模板后会自动创建项目，你可以在编辑器中自由调整
        </div>
      </div>
    </div>
  );
}
