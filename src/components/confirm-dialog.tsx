import { useEffect, useRef, useCallback } from "react";
import { useT } from "@/hooks/use-page-t";
import { useDialogFocus } from "@/hooks/use-dialog-focus";

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
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  const confirmLabel = confirmText ?? t("common.confirm");
  const cancelLabel = cancelText ?? t("common.cancel");
  // 焦点默认落在「取消」：危险按钮自动聚焦会让顺手一回车变成不可逆操作
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef, cancelRef);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (!open) return;
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
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-bg-elevated p-6 shadow-xl animate-dialog"
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
            ref={cancelRef}
            onClick={onCancel}
            className="rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-danger px-3 py-1.5 text-sm text-white hover:bg-danger/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
