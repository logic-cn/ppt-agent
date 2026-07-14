import { X } from "lucide-react";
import { PresetLibrary } from "./PresetLibrary";
import type { DeckPreset } from "@/types/preset";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (preset: DeckPreset) => void;
}

export function PresetLibraryDialog({ open, onClose, onPick }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-library-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="preset-library-title" className="text-base font-semibold">
            示例库
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted transition hover:bg-bg-hover hover:text-text-primary"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <PresetLibrary
            onPick={(p) => {
              onPick(p);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
