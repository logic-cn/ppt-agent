import { AlertTriangle, XCircle, Wand2, X } from "lucide-react";
import type { QualityFinding, Severity } from "@/services/quality";
import { qualityScore } from "@/services/quality";
import { useT } from "@/hooks/use-page-t";

interface QualityReportProps {
  findings: QualityFinding[];
  fixing?: boolean;
  onAutoFix?: () => void;
  onDismiss?: () => void;
}

const severityMeta: Record<
  Severity,
  { color: string; icon: typeof AlertTriangle }
> = {
  hard: { color: "text-red-500", icon: XCircle },
  soft: { color: "text-amber-500", icon: AlertTriangle },
};

function scoreColor(score: number): string {
  if (score >= 90) return "text-green-500";
  if (score >= 70) return "text-amber-500";
  return "text-red-500";
}

export function QualityReport({
  findings,
  fixing = false,
  onAutoFix,
  onDismiss,
}: QualityReportProps) {
  const t = useT();
  if (findings.length === 0) return null;

  const score = qualityScore(findings);
  const counts = {
    hard: findings.filter((f) => f.severity === "hard").length,
    soft: findings.filter((f) => f.severity === "soft").length,
  };
  const autoFixableCount = findings.filter((f) => f.autoFixable).length;

  return (
    <div className="rounded-xl border border-border bg-bg-surface p-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t("quality.title")}
          </span>
          <span className={`text-lg font-semibold ${scoreColor(score)}`}>
            {score}
          </span>
          <div className="flex items-center gap-1.5 text-[11px]">
            {counts.hard > 0 && (
              <span className="text-red-500">
                {t("quality.hardCount", { count: counts.hard })}
              </span>
            )}
            {counts.soft > 0 && (
              <span className="text-amber-500">
                {t("quality.softCount", { count: counts.soft })}
              </span>
            )}
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="rounded p-0.5 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
            title={t("common.close")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ul className="mt-2 space-y-1.5">
        {findings.map((finding, idx) => {
          const meta = severityMeta[finding.severity];
          const Icon = meta.icon;
          return (
            <li
              key={`${finding.rule}-${finding.slideId ?? idx}`}
              className="flex items-start gap-1.5 text-xs text-text-secondary"
            >
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${meta.color}`} />
              <span>{finding.message}</span>
            </li>
          );
        })}
      </ul>

      {onAutoFix && (
        <button
          onClick={onAutoFix}
          disabled={fixing || autoFixableCount === 0}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-ai to-orange-400 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 shadow-sm shadow-ai/20"
        >
          <Wand2 className="h-3.5 w-3.5" />
          {fixing
            ? t("quality.fixing")
            : t("quality.autoFix", { count: autoFixableCount })}
        </button>
      )}
    </div>
  );
}
