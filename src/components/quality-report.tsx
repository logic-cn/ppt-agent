import { AlertTriangle, XCircle, Wand2, X, Eye } from "lucide-react";
import type { QualityFinding, Severity } from "@/services/quality";
import { qualityScore } from "@/services/quality";
import { localizeFinding } from "@/services/quality/message-i18n";
import { useT } from "@/hooks/use-page-t";
import { useSettingsStore } from "@/store/settings";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

interface QualityReportProps {
  findings: QualityFinding[];
  fixing?: boolean;
  onAutoFix?: () => void;
  onDismiss?: () => void;
  /** D3 视觉自检：提供时显示入口按钮 */
  onVisualReview?: () => void;
  visualReviewing?: boolean;
}

const severityMeta: Record<
  Severity,
  { color: string; icon: typeof AlertTriangle }
> = {
  hard: { color: "text-danger", icon: XCircle },
  soft: { color: "text-warning", icon: AlertTriangle },
};

function scoreColor(score: number): string {
  if (score >= 90) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-danger";
}

export function QualityReport({
  findings,
  fixing = false,
  onAutoFix,
  onDismiss,
  onVisualReview,
  visualReviewing = false,
}: QualityReportProps) {
  const t = useT();
  const lang = useSettingsStore((s) => s.settings.lang);
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
          <span className="text-xs font-medium text-text-muted">
            {t("quality.title")}
          </span>
          <span className={`text-lg font-semibold ${scoreColor(score)}`}>
            {score}
          </span>
          <div className="flex items-center gap-1.5 text-[11px]">
            {counts.hard > 0 && (
              <span className="text-danger">
                {t("quality.hardCount", { count: counts.hard })}
              </span>
            )}
            {counts.soft > 0 && (
              <span className="text-warning">
                {t("quality.softCount", { count: counts.soft })}
              </span>
            )}
          </div>
        </div>
        {onDismiss && (
          <IconButton
            label={t("common.close")}
            onClick={onDismiss}
            icon={<X className="h-3.5 w-3.5" />}
          />
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
              <span>{localizeFinding(finding, lang)}</span>
            </li>
          );
        })}
      </ul>

      {onVisualReview && (
        <Button
          size="xs"
          variant="outline"
          onClick={onVisualReview}
          disabled={visualReviewing || fixing}
          className="mt-3 w-full font-medium"
        >
          <Eye className="h-3.5 w-3.5" />
          {visualReviewing
            ? t("quality.visualReviewing")
            : t("quality.visualReview")}
        </Button>
      )}

      {onAutoFix && (
        <Button
          size="xs"
          variant="ai"
          onClick={onAutoFix}
          disabled={fixing || autoFixableCount === 0}
          className="mt-3 w-full bg-gradient-to-r from-ai to-ai-hover font-medium hover:opacity-90"
        >
          <Wand2 className="h-3.5 w-3.5" />
          {fixing
            ? t("quality.fixing")
            : t("quality.autoFix", { count: autoFixableCount })}
        </Button>
      )}
    </div>
  );
}
