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

export interface Job {
  id: string;
  type: JobType;
  title: string;
  status: JobStatus;
  progress?: number;
  message?: string;
  error?: string;
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
