import { AlertTriangle, XCircle, Info, Wand2, X } from "lucide-react";
import type { DeckQualityReport, DeckQualityIssue } from "@/services/quality";

interface QualityReportProps {
  report: DeckQualityReport;
  fixing?: boolean;
  onAutoFix?: () => void;
  onDismiss?: () => void;
}

const severityMeta: Record<
  DeckQualityIssue["severity"],
  { label: string; color: string; icon: typeof AlertTriangle }
> = {
  error: { label: "错误", color: "text-red-500", icon: XCircle },
  warning: { label: "警告", color: "text-amber-500", icon: AlertTriangle },
  info: { label: "提示", color: "text-sky-500", icon: Info },
};

function scoreColor(score: number): string {
  if (score >= 90) return "text-green-500";
  if (score >= 70) return "text-amber-500";
  return "text-red-500";
}

export function QualityReport({
  report,
  fixing = false,
  onAutoFix,
  onDismiss,
}: QualityReportProps) {
  const { score, issues } = report;
  if (issues.length === 0) return null;

  const counts = {
    error: issues.filter((i) => i.severity === "error").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  };

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            质量检查
          </span>
          <span className={`text-lg font-semibold ${scoreColor(score)}`}>
            {score}
          </span>
          <div className="flex items-center gap-1.5 text-[11px]">
            {counts.error > 0 && (
              <span className="text-red-500">错误 {counts.error}</span>
            )}
            {counts.warning > 0 && (
              <span className="text-amber-500">警告 {counts.warning}</span>
            )}
            {counts.info > 0 && (
              <span className="text-sky-500">提示 {counts.info}</span>
            )}
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="rounded p-0.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ul className="mt-2 space-y-1.5">
        {issues.map((issue, idx) => {
          const meta = severityMeta[issue.severity];
          const Icon = meta.icon;
          return (
            <li
              key={`${issue.code}-${issue.slideId ?? idx}`}
              className="flex items-start gap-1.5 text-xs text-text-secondary"
            >
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${meta.color}`} />
              <span>{issue.message}</span>
            </li>
          );
        })}
      </ul>

      {onAutoFix && (
        <button
          onClick={onAutoFix}
          disabled={fixing || counts.error + counts.warning === 0}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          <Wand2 className="h-3.5 w-3.5" />
          {fixing ? "修复中…" : "一键修复"}
        </button>
      )}
    </div>
  );
}
