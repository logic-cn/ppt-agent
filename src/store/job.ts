import { create } from "zustand";
import type {
  Job,
  JobStatus,
  JobErrorCategory,
  StartJobInput,
  RunningJob,
} from "@/services/jobs/types";
import { t } from "@/services/i18n";

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

/** 将异常归类为「用户取消 / 网络 / 模型 / 解析 / 未知」，便于 UI 区分展示 */
export function classifyError(error: unknown): {
  category: JobErrorCategory;
  message: string;
} {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : t("job.unknownError");

  // 用户取消：AbortError 或显式取消信号
  if (
    error instanceof DOMException ||
    (error as { name?: string })?.name === "AbortError" ||
    /已取消|已停止|aborted|user cancel/i.test(raw)
  ) {
    return { category: "user_cancelled", message: t("job.cancelled") };
  }

  // 网络错误
  if (
    /failed to fetch|networkerror|timeout|etimedout|enotfound|econnrefused|网络|连接/i.test(
      raw,
    )
  ) {
    return { category: "network", message: t("job.networkError", { raw }) };
  }

  // 解析错误：AI 返回结构非法
  if (
    /(invalid|expected|zod|json\.parse|jsonparse|schema|结构|解析失败|无法解析)/i.test(
      raw,
    )
  ) {
    return { category: "parse", message: t("job.parseError", { raw }) };
  }

  // 模型错误：鉴权、限流、配额
  if (
    /(401|403|429|unauthorized|forbidden|rate.?limit|quota|api key|模型|model|token limit|上下文)/i.test(
      raw,
    )
  ) {
    return { category: "model", message: t("job.modelError", { raw }) };
  }

  return { category: "unknown", message: raw };
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
    // 终态保护：已取消的 job 不被 succeed 覆盖（fn 忽略 abort 正常返回的竞态）
    if (get().jobs.find((j) => j.id === id)?.status === "cancelled") return;
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
    // 终态保护：已取消的 job 不被 fail 覆盖（取消后的连锁异常不算新失败）
    if (get().jobs.find((j) => j.id === id)?.status === "cancelled") return;
    const { category, message } = classifyError(error);
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              status: "failed" as JobStatus,
              error: message,
              errorCategory: category,
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
    // 仍在运行的 job 先中止再移除，避免清掉记录后异步结果继续写 deck
    const controller = controllers.get(id);
    if (controller) {
      controller.abort();
      controllers.delete(id);
    }
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
  // 进入执行即标记 running：此前 job 全程停留在 queued，任务面板的
  // 运行中状态与进度渲染永远不会出现
  job.update({ status: "running" });
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
