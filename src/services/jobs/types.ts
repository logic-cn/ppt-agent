export type JobType =
  | "outline.generate"
  | "content.generate"
  | "content.generate_batch"
  | "document.import"
  | "image.generate"
  | "pptx.export"
  | "deck.patch";

export type JobStatus =
  "queued" | "running" | "succeeded" | "failed" | "cancelled";

/** 任务失败的错误分类，便于 UI 区分展示与重试策略 */
export type JobErrorCategory =
  "user_cancelled" | "network" | "model" | "parse" | "unknown";

export interface Job {
  id: string;
  type: JobType;
  title: string;
  status: JobStatus;
  progress?: number;
  message?: string;
  error?: string;
  errorCategory?: JobErrorCategory;
  createdAt: number;
  updatedAt: number;
  canCancel: boolean;
}

export interface StartJobInput {
  type: JobType;
  title: string;
  canCancel?: boolean;
}

export interface RunningJob {
  id: string;
  signal: AbortSignal;
  update: (patch: Partial<Job>) => void;
  succeed: (message?: string) => void;
  fail: (error: unknown) => void;
  cancel: () => void;
}
