import { useEffect, useRef, useCallback } from "react";
import { t } from "@/services/i18n";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = t("confirm"),
  cancelText = t("cancel"),
  onConfirm,
  onCancel,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (!open) return;
    btnRef.current?.focus();
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <h3 className="mb-2 text-sm font-semibold text-text-primary">
          {title}
        </h3>
        <p className="mb-4 text-sm text-text-secondary">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover"
          >
            {cancelText}
          </button>
          <button
            ref={btnRef}
            onClick={onConfirm}
            className="rounded-lg bg-danger px-3 py-1.5 text-sm text-white hover:bg-danger/90"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );
}
