import { useEffect, useRef } from "react";

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
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onCancel,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) btnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-bg-surface p-5 shadow-xl">
        <h3 className="mb-2 text-sm font-semibold text-text-primary">
          {title}
        </h3>
        <p className="mb-4 text-sm text-text-secondary">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
          >
            {cancelText}
          </button>
          <button
            ref={btnRef}
            onClick={onConfirm}
            className="rounded-md bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );
}
