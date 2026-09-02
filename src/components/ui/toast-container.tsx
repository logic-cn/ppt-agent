import { useToastStore } from "@/store/toast";
import { X } from "lucide-react";

const dotMap = {
  success: "bg-success",
  error: "bg-danger",
  info: "bg-accent",
  warning: "bg-warning",
};

export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-bg-elevated px-4 py-3 shadow-lg"
          style={{ minWidth: 280, maxWidth: 400 }}
        >
          <span
            className={`mt-1 h-4 w-4 shrink-0 rounded-full ${dotMap[t.type]}`}
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">{t.title}</p>
            {t.message && (
              <p className="mt-0.5 text-xs text-text-secondary">{t.message}</p>
            )}
          </div>
          <button
            onClick={() => remove(t.id)}
            className="shrink-0 rounded p-0.5 text-text-muted opacity-60 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
