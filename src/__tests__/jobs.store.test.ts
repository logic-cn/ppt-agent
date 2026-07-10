import { describe, it, expect, beforeEach } from "vitest";
import { useJobStore, runJob, classifyError } from "@/store/job";

describe("useJobStore", () => {
  beforeEach(() => {
    useJobStore.setState({ jobs: [], activeJobIds: [] });
  });

  it("startJob 创建 job 并返回 RunningJob", () => {
    const job = useJobStore.getState().startJob({
      type: "outline.generate",
      title: "生成大纲",
    });
    expect(job.id).toBeTruthy();
    expect(job.signal).toBeInstanceOf(AbortSignal);

    const state = useJobStore.getState();
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0].status).toBe("queued");
    expect(state.activeJobIds).toHaveLength(1);
  });

  it("updateJob 更新 job 进度", () => {
    const job = useJobStore.getState().startJob({
      type: "outline.generate",
      title: "生成大纲",
    });
    job.update({ progress: 0.5, message: "正在生成" });
    const state = useJobStore.getState();
    expect(state.jobs[0].progress).toBe(0.5);
    expect(state.jobs[0].message).toBe("正在生成");
  });

  it("succeedJob 标记成功并移除 activeJobId", () => {
    const job = useJobStore.getState().startJob({
      type: "outline.generate",
      title: "生成大纲",
    });
    job.succeed("生成完成");
    const state = useJobStore.getState();
    expect(state.jobs[0].status).toBe("succeeded");
    expect(state.jobs[0].progress).toBe(1);
    expect(state.activeJobIds).toHaveLength(0);
  });

  it("failJob 标记失败并保留错误与分类", () => {
    const job = useJobStore.getState().startJob({
      type: "outline.generate",
      title: "生成大纲",
    });
    job.fail(new Error("网络错误"));
    const state = useJobStore.getState();
    expect(state.jobs[0].status).toBe("failed");
    expect(state.jobs[0].errorCategory).toBe("network");
    expect(state.jobs[0].error).toContain("网络错误");
    expect(state.activeJobIds).toHaveLength(0);
  });

  it("cancelJob 中止 controller 并标记取消", () => {
    const job = useJobStore.getState().startJob({
      type: "outline.generate",
      title: "生成大纲",
    });
    job.cancel();
    const state = useJobStore.getState();
    expect(state.jobs[0].status).toBe("cancelled");
  });

  it("clearJob 移除 job", () => {
    useJobStore.getState().startJob({
      type: "outline.generate",
      title: "生成大纲",
    });
    expect(useJobStore.getState().jobs).toHaveLength(1);
    useJobStore.getState().clearJob(useJobStore.getState().jobs[0].id);
    expect(useJobStore.getState().jobs).toHaveLength(0);
  });

  it("clearFinishedJobs 只保留运行中的 job", () => {
    const j1 = useJobStore
      .getState()
      .startJob({ type: "outline.generate", title: "运行中" });
    useJobStore.getState().updateJob(j1.id, { status: "running" });
    const j2 = useJobStore
      .getState()
      .startJob({ type: "outline.generate", title: "已完成" });
    j2.succeed();
    const j3 = useJobStore
      .getState()
      .startJob({ type: "outline.generate", title: "失败" });
    j3.fail("err");

    useJobStore.getState().clearFinishedJobs();
    const state = useJobStore.getState();
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0].title).toBe("运行中");
  });
});

describe("runJob", () => {
  beforeEach(() => {
    useJobStore.setState({ jobs: [], activeJobIds: [] });
  });

  it("成功执行后标记 succeeded", async () => {
    const result = await runJob(
      { type: "outline.generate", title: "测试任务" },
      async () => "done",
    );
    expect(result).toBe("done");
    const state = useJobStore.getState();
    expect(state.jobs[0].status).toBe("succeeded");
  });

  it("失败后标记 failed", async () => {
    await expect(
      runJob({ type: "outline.generate", title: "测试任务" }, async () => {
        throw new Error("出错了");
      }),
    ).rejects.toThrow("出错了");
    const state = useJobStore.getState();
    expect(state.jobs[0].status).toBe("failed");
    expect(state.jobs[0].error).toBe("出错了");
  });

  it("取消后标记 cancelled", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);

    await expect(
      runJob({ type: "outline.generate", title: "测试任务" }, async (_job) => {
        await new Promise((_resolve, reject) => {
          const onAbort = () => {
            controller.signal.removeEventListener("abort", onAbort);
            reject(new DOMException("Aborted", "AbortError"));
          };
          controller.signal.addEventListener("abort", onAbort);
        });
      }),
    ).rejects.toThrow();
  });
});

describe("classifyError", () => {
  it("用户取消归为 user_cancelled", () => {
    const r = classifyError(new DOMException("Aborted", "AbortError"));
    expect(r.category).toBe("user_cancelled");
  });

  it("网络错误归为 network", () => {
    const r = classifyError(new Error("Failed to fetch"));
    expect(r.category).toBe("network");
  });

  it("解析错误归为 parse", () => {
    const r = classifyError(new Error("ZodError: 结构非法"));
    expect(r.category).toBe("parse");
  });

  it("鉴权/限流归为 model", () => {
    const r = classifyError(new Error("401 Unauthorized"));
    expect(r.category).toBe("model");
  });

  it("未知错误归为 unknown", () => {
    const r = classifyError(new Error("something weird"));
    expect(r.category).toBe("unknown");
  });
});
