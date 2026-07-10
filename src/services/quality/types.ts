export type QualityIssueCode =
  | "missing_cover"
  | "missing_closing"
  | "duplicate_title"
  | "too_many_bullets"
  | "empty_chart"
  | "layout_content_mismatch"
  | "title_too_generic"
  | "page_count_mismatch"
  | "chart_required"
  | "data_required";

export interface DeckQualityIssue {
  severity: "error" | "warning" | "info";
  slideId?: string;
  code: QualityIssueCode;
  message: string;
}

export interface DeckQualityReport {
  score: number;
  issues: DeckQualityIssue[];
  suggestions: string[];
}

export interface AutoFixAction {
  type:
    "set_title" | "remove_empty_bullet" | "change_layout" | "append_closing";
  slideId?: string;
  description: string;
}
