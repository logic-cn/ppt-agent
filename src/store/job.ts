import { create } from "zustand";
import type {
  Job,
  JobStatus,
  StartJobInput,
  RunningJob,
} from "@/services/jobs/types";

interface JobStoreState {
  jobs: Job[];
  activeJobIds: string[];

  startJob: (input: StartJobInput) => RunningJob;
  updateJob: (id: string, patch: Partial<Job>) => void;
  succeedJob: (id: string, message?: string) => void;
  failJob: (id: string, error: unknown) => void;
  cancelJob: (id: string) => void;
  clearJob: (id: string) => void;
  clearFinishedJobs: () => void;
}

const controllers = new Map<string, AbortController>();

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "未知错误";
}

export const useJobStore = create<JobStoreState>((set, get) => ({
  jobs: [],
  activeJobIds: [],

  startJob: (input) => {
    const id = crypto.randomUUID();
    const controller = new AbortController();
    controllers.set(id, controller);

    const job: Job = {
      id,
      type: input.type,
      title: input.title,
      status: "queued",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      canCancel: input.canCancel ?? true,
    };

    set((s) => ({
      jobs: [...s.jobs, job],
      activeJobIds: [...s.activeJobIds, id],
    }));

    const runningJob: RunningJob = {
      id,
      get signal() {
        return controller.signal;
      },
      update: (patch) => get().updateJob(id, patch),
      succeed: (message) => get().succeedJob(id, message),
      fail: (error) => get().failJob(id, error),
      cancel: () => get().cancelJob(id),
    };

    return runningJob;
  },

  updateJob: (id, patch) => {
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              ...patch,
              updatedAt: Date.now(),
              status: patch.status ?? j.status,
            }
          : j,
      ),
    }));
  },

  succeedJob: (id, message) => {
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              status: "succeeded" as JobStatus,
              message: message ?? j.message,
              updatedAt: Date.now(),
              progress: 1,
            }
          : j,
      ),
      activeJobIds: s.activeJobIds.filter((aid) => aid !== id),
    }));
    controllers.delete(id);
  },

  failJob: (id, error) => {
    const errMsg = formatError(error);
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              status: "failed" as JobStatus,
              error: errMsg,
              updatedAt: Date.now(),
            }
          : j,
      ),
      activeJobIds: s.activeJobIds.filter((aid) => aid !== id),
    }));
    controllers.delete(id);
  },

  cancelJob: (id) => {
    const controller = controllers.get(id);
    if (controller) {
      controller.abort();
      controllers.delete(id);
    }
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id
          ? { ...j, status: "cancelled" as JobStatus, updatedAt: Date.now() }
          : j,
      ),
      activeJobIds: s.activeJobIds.filter((aid) => aid !== id),
    }));
  },

  clearJob: (id) => {
    controllers.delete(id);
    set((s) => ({
      jobs: s.jobs.filter((j) => j.id !== id),
      activeJobIds: s.activeJobIds.filter((aid) => aid !== id),
    }));
  },

  clearFinishedJobs: () => {
    set((s) => ({
      jobs: s.jobs.filter(
        (j) => j.status === "queued" || j.status === "running",
      ),
    }));
  },
}));

export async function runJob<T>(
  input: StartJobInput,
  fn: (job: RunningJob) => Promise<T>,
): Promise<T> {
  const job = useJobStore.getState().startJob(input);
  try {
    const result = await fn(job);
    job.succeed();
    return result;
  } catch (error) {
    if (job.signal.aborted) {
      job.cancel();
    } else {
      job.fail(error);
    }
    throw error;
  }
}
