import { useState, useRef, useCallback, useEffect } from "react";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  LayoutTemplate,
  Square,
} from "lucide-react";
import { isUntitledDeck } from "@/services/storage";
import { useDeckStore } from "@/store/deck";
import { runJob, useJobStore } from "@/store/job";
import { useQualityStore } from "@/store/quality";
import { useSettingsStore } from "@/store/settings";
import { useModelStore } from "@/store/model";
import { isLocalProviderConfig } from "@/types/llm";
import { buildDeckSvgs } from "@/engine/svg/pipeline";
import { runFirstPageGate } from "@/services/generation/first-page-gate";
import {
  isTopicRequest,
  deriveProjectName,
} from "@/services/generation/topic-intent";
import { researchTopic } from "@/services/research";
import { useGenerationFollowStore } from "@/store/generation-follow";
import { withAppLanguage } from "@/services/generation/generation-options";
import { semanticRoleToLayout } from "@/types/page-plan";
import type { GenerationOptions } from "@/types/generation";
import { GenerationOptionsBar } from "@/components/chat/generation-options-bar";
import { generateDeckPatches } from "@/services/deck-patch/ai";
import { applyDeckPatches } from "@/services/deck-patch/apply";
import { summarizePatches } from "@/services/deck-patch/summarize";
import type { DeckPatch } from "@/services/deck-patch/types";
import { DESTRUCTIVE_OPS } from "@/services/deck-patch/types";
import {
  checkDeckQuality,
  applyAutoFixes,
  applyAutoFixActions,
  generateAutoFixes,
  getHardFindings,
} from "@/services/quality";
import { applyUserIntent } from "@/services/intent-parser";
import { reviewSlideVisual } from "@/services/quality/visual-review";
import { localizeFinding } from "@/services/quality/message-i18n";
import { generateSlideSvg } from "@/engine/svg/executor";
import { buildSpecLock } from "@/design/spec-lock";
import type { DeckPreset } from "@/types/preset";
import type { Slide } from "@/types/deck";
import { PresetPickerDialog } from "@/components/preset/PresetPickerDialog";
import { getPresetDisplay } from "@/presets/display";
import { DEFAULT_DESIGN } from "@/types/design";
import { QualityReport } from "@/components/quality-report";
import { useT } from "@/hooks/use-page-t";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  patches?: DeckPatch[];
  summary?: string;
  destructive?: boolean;
  error?: boolean;
  /** 生成建议时的 deck.updatedAt：应用前校验 deck 是否已被手动修改 */
  patchBaseUpdatedAt?: number;
}

export function ChatPanel() {
  const t = useT();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("chat.welcome"),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [firstPageGateMsg, setFirstPageGateMsg] = useState<string | null>(null);
  const [visualReviewing, setVisualReviewing] = useState(false);
  // 生成前参数控制（路线图 §7.3）：场景/语气/密度/受众/图表倾向/页数
  const [showGenOptions, setShowGenOptions] = useState(false);
  const [genOptions, setGenOptions] = useState<GenerationOptions>({});
  const qualityReport = useQualityStore((s) => s.report);

  const copyMessage = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard 不可用时静默失败
    }
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replaceSlides = useDeckStore((s) => s.replaceSlides);
  const addSlide = useDeckStore((s) => s.addSlide);
  const setTitle = useDeckStore((s) => s.setTitle);

  // 新消息自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // 输入框随内容自动增高（上限与 max-h-32 一致）
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  const addMessage = useCallback(
    (
      role: "user" | "assistant",
      content: string,
      patches?: DeckPatch[],
      summary?: string,
      destructive?: boolean,
      error?: boolean,
      patchBaseUpdatedAt?: number,
    ) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role,
          content,
          patches,
          summary,
          destructive,
          error,
          patchBaseUpdatedAt,
        },
      ]);
    },
    [],
  );

  // 用户放弃该 patch 建议：移除确认按钮（保留摘要文本）
  const dismissPatches = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, patches: undefined } : m)),
    );
  }, []);

  const applyPatches = useCallback(
    (msg: Message) => {
      const deck = useDeckStore.getState().deck;
      if (!msg.patches || !deck) return;
      // 新鲜度检查：建议生成后 deck 已被手动编辑、且这批 patch 含整页
      // 覆盖（update/replace）时拒绝应用，防止静默吞掉用户的编辑
      const stale =
        msg.patchBaseUpdatedAt !== undefined &&
        deck.updatedAt !== msg.patchBaseUpdatedAt;
      const overwriting = msg.patches.some(
        (p) => p.op === "update_slide" || p.op === "replace_slide",
      );
      if (stale && overwriting) {
        addMessage("assistant", t("chat.patchStaleBlock"));
        dismissPatches(msg.id);
        return;
      }
      try {
        const result = applyDeckPatches(deck, msg.patches);
        const fatal = result.warnings.find((w) => w.fatal);
        if (fatal) {
          addMessage(
            "assistant",
            t("chat.applyFailed", { error: fatal.message }),
          );
          return;
        }
        replaceSlides(result.deck.slides);
        if (result.deck.title !== deck.title) {
          setTitle(result.deck.title);
        }
        dismissPatches(msg.id);
        addMessage(
          "assistant",
          `✅ ${t("chat.applied", {
            changes: result.applied.map((a) => a.description).join("；"),
          })}`,
          undefined,
          undefined,
          false,
        );
      } catch (e) {
        addMessage(
          "assistant",
          t("chat.applyFailed", { error: (e as Error).message }),
        );
      }
    },
    [replaceSlides, setTitle, addMessage, dismissPatches],
  );

  // 生成完成后跑一次质量检查，并把报告写入全局 store
  // 若 pendingRules 存在（来自模板），则作为模板质量规则一并检查
  // pageCount：来自生成设置，用于校验实际页数与期望页数的偏差（路线图 §7.6）
  const runQualityCheck = useCallback(
    (pageCount?: number, sourceText?: string) => {
      const current = useDeckStore.getState().deck;
      const qualityStore = useQualityStore.getState();
      const rules = qualityStore.pendingRules ?? undefined;
      qualityStore.clearPendingRules();
      qualityStore.setReport(
        current
          ? checkDeckQuality(current, { rules, pageCount, sourceText })
          : null,
      );
    },
    [],
  );

  // D3 视觉自检：逐页截图送视觉模型审查，不通过页携带问题定向重画一轮
  const handleVisualReview = useCallback(async () => {
    const current = useDeckStore.getState().deck;
    if (!current || visualReviewing) return;
    setVisualReviewing(true);
    try {
      await runJob(
        {
          type: "content.generate",
          title: t("chat.visualReviewJob"),
          canCancel: true,
        },
        async (job) => {
          const spec = buildSpecLock(current.design);
          const fixed = [...current.slides];
          let fixedCount = 0;
          for (let i = 0; i < fixed.length; i++) {
            if (job.signal.aborted)
              throw new DOMException("Aborted", "AbortError");
            const slide = fixed[i];
            if (!slide.svg) continue;
            job.update({
              message: t("chat.visualReviewProgress", {
                n: i + 1,
                total: fixed.length,
              }),
            });
            const review = await reviewSlideVisual({
              svg: slide.svg,
              specLock: spec,
              signal: job.signal,
            });
            if (review.pass || review.issues.length === 0) continue;
            // 不通过：以审查发现为定向指令重画一轮（失败保留原稿）
            try {
              const svg = await generateSlideSvg({
                specLock: spec,
                plan: {
                  role: "content",
                  title: slide.title,
                  intent: slide.title,
                  bullets: (slide.bullets ?? []).map((b) => b.text),
                },
                pageIndex: i,
                totalPages: fixed.length,
                baseSvg: slide.svg,
                instruction: review.issues.join("；"),
                signal: job.signal,
              });
              fixed[i] = { ...slide, svg, svgStale: false };
              fixedCount += 1;
            } catch {
              // 单页修复失败保留原稿
            }
          }
          if (fixedCount > 0) {
            await replaceSlides(fixed);
            runQualityCheck();
          }
          addMessage(
            "assistant",
            t("chat.visualReviewDone", {
              total: current.slides.length,
              fixed: fixedCount,
            }),
          );
          return fixedCount;
        },
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        addMessage(
          "assistant",
          t("chat.visualReviewFailed", { error: (e as Error).message }),
        );
      }
    } finally {
      setVisualReviewing(false);
    }
  }, [visualReviewing, replaceSlides, runQualityCheck, addMessage]);

  const handleAutoFix = useCallback(async () => {
    const current = useDeckStore.getState().deck;
    if (!current) return;
    setFixing(true);
    try {
      // (a) 先跑质量检查，拿到分级后的 findings
      const qualityStore = useQualityStore.getState();
      const rules = qualityStore.pendingRules ?? undefined;
      qualityStore.clearPendingRules();
      const findings = checkDeckQuality(current, { rules });
      // (b) applyAutoFixes 只会处理 soft+autoFixable；再叠加 generateAutoFixes
      //     的结构修复（占位标题/空要点/空图表布局/缺结尾页）
      let fixed = applyAutoFixes(current, findings);
      fixed = applyAutoFixActions(fixed, generateAutoFixes(fixed));
      // 仅当确有修复时才替换 slides；hard 问题绝不自动修复
      if (fixed !== current) {
        await replaceSlides(fixed.slides);
      }
      const newDeck = useDeckStore.getState().deck!;
      // 重新检查并把完整报告（含 hard）写回，确保 hard 问题对用户可见
      const newFindings = checkDeckQuality(newDeck, { rules });
      useQualityStore.getState().setReport(newFindings);
      // hard 以修复后的检查为准：结构修复（空图表改布局/补结尾页）会消除部分 hard 项
      const hard = getHardFindings(newFindings);
      if (hard.length > 0) {
        // (c) hard 问题阻断导出，仅提示不自动修复
        const prefix = fixed !== current ? t("chat.autoFixedSome") : "";
        addMessage(
          "assistant",
          `⚠️${prefix}${t("chat.hardIssuesRemain", {
            count: hard.length,
            issues: hard.map((f) => f.message).join("；"),
          })}`,
        );
      } else if (fixed !== current) {
        addMessage("assistant", `✅ ${t("chat.autoFixedAll")}`);
      } else {
        addMessage("assistant", t("chat.noAutoFix"));
      }
    } finally {
      setFixing(false);
    }
  }, [replaceSlides, addMessage]);

  const submittingRef = useRef(false);
  const lastUserText = useRef("");
  // 当前由本面板启动且可取消的 job：供「停止」按钮终止生成
  const runningJobIdRef = useRef<string | null>(null);

  const stopActiveJob = () => {
    const id = runningJobIdRef.current;
    if (id) useJobStore.getState().cancelJob(id);
  };

  const handleSubmit = useCallback(
    async (override?: string) => {
      const text = (override ?? input).trim();
      // 用 ref 守卫避免快速连点/重复提交绕过 loading 状态
      if (!text || submittingRef.current) return;
      submittingRef.current = true;
      lastUserText.current = text;
      const deck = useDeckStore.getState().deck;
      setInput("");
      addMessage("user", text);
      setLoading(true);
      setFirstPageGateMsg(null);

      let researchSourceText: string | undefined;
      try {
        // 检查是否包含主题相关的生成意图
        const isTopic = isTopicRequest(text);

        if (isTopic) {
          // 通过 runJob 统一封装 job 生命周期（生成大纲）
          addMessage("assistant", t("chat.generatingOutline"));

          let slides;
          let streamed = false;
          try {
            slides = await runJob(
              {
                type: "outline.generate",
                title: t("chat.generateOutline"),
                canCancel: true,
              },
              async (job) => {
                runningJobIdRef.current = job.id;
                // X1 管线：用 buildDeckSvgs 生成 svg 设计真相
                const targetDeck =
                  deck ?? (await useDeckStore.getState().createDeck());
                // 本地模型：确保已下载并加载（进度与操作入口见输入框上方门控卡片）
                {
                  const st = useSettingsStore.getState().settings;
                  const activeCfg = st.providers[st.activeProvider];
                  if (activeCfg && isLocalProviderConfig(activeCfg)) {
                    await useModelStore.getState().ensureReady();
                    if (job.signal.aborted)
                      throw new DOMException("Aborted", "AbortError");
                  }
                }
                // D4 联网补料：开启研究时先检索资料作为 docContent（失败静默跳过）
                let docContent: string | undefined;
                const settings = useSettingsStore.getState().settings;
                if (settings.researchEnabled && settings.tavilyApiKey?.trim()) {
                  job.update({
                    message: t("chat.researching"),
                  });
                  try {
                    const research = await researchTopic(text, {
                      apiKey: settings.tavilyApiKey.trim(),
                      signal: job.signal,
                    });
                    if (research.text) {
                      docContent = research.text.slice(0, 12000);
                      researchSourceText = research.text;
                      addMessage(
                        "assistant",
                        t("chat.researchDone", {
                          n: research.sources.length,
                        }),
                      );
                    }
                  } catch (e) {
                    if (job.signal.aborted) throw e;
                    // 检索失败不阻断生成
                    addMessage(
                      "assistant",
                      t("chat.researchFailed", {
                        error: (e as Error).message,
                      }),
                    );
                  }
                }
                const newDeck = await buildDeckSvgs(
                  targetDeck,
                  deck?.design ?? DEFAULT_DESIGN,
                  {
                    topic: text,
                    docContent,
                    pageCount: deck?.slides.length ? undefined : 8,
                    // 生成前参数：用户设置 + 界面语言映射的输出语言
                    options: withAppLanguage(
                      genOptions,
                      useSettingsStore.getState().settings.lang,
                    ),
                    signal: job.signal,
                    // D2 流式预览：规划完成即上屏占位页（历史快照=生成前状态），
                    // 之后每页 SVG 就绪时静默填充，编辑器预览随生成逐步呈现
                    onPlanReady: (pages) => {
                      if (job.signal.aborted) return;
                      useGenerationFollowStore.getState().setGeneratingIndex(0);
                      replaceSlides(
                        pages.map((p, i) => ({
                          id: `s${i + 1}`,
                          layout: semanticRoleToLayout(p.role),
                          title: p.title,
                        })),
                      );
                      streamed = true;
                    },
                    onPageReady: (i, svg) => {
                      if (job.signal.aborted) return;
                      useGenerationFollowStore.getState().setPartialText("");
                      useGenerationFollowStore.getState().setGeneratingIndex(i);
                      useDeckStore.getState().updateSlideSvgLive(i, svg);
                    },
                  },
                );
                return { slides: newDeck.slides, streamed };
              },
            );
          } catch {
            return;
          }
          // 流式路径中 slides 已经在 deck 里（onPlanReady/onPageReady 上屏）
          const generatedSlides = Array.isArray(slides)
            ? slides
            : slides.slides;
          streamed = !Array.isArray(slides) && slides.streamed;

          if (streamed) {
            // 流式路径：内容已在 deck，仅做质量检查/首屏门/命名
            runQualityCheck(genOptions.pageCount, researchSourceText);
            const currentDeck = useDeckStore.getState().deck!;
            const gate = runFirstPageGate(
              currentDeck,
              deck?.design ?? DEFAULT_DESIGN,
            );
            const hardMsgs = gate
              .filter((f) => f.severity === "hard")
              .map((f) =>
                localizeFinding(f, useSettingsStore.getState().settings.lang),
              );
            setFirstPageGateMsg(
              hardMsgs.length > 0
                ? t("chat.firstPageGateFailed", {
                    issues: hardMsgs.join("；"),
                  })
                : null,
            );
            if (deck && isUntitledDeck(deck)) {
              const name = deriveProjectName(text);
              if (name) setTitle(name);
            }
            addMessage(
              "assistant",
              t("chat.outlineGenerated", { count: generatedSlides.length }),
            );
            return;
          }

          if (deck) {
            await replaceSlides(generatedSlides);
            runQualityCheck(genOptions.pageCount, researchSourceText);
            // 首屏风格锚点：仅检查首屏，hard 问题以横幅提示，不阻断生成
            const design = deck.design ?? DEFAULT_DESIGN;
            const gate = runFirstPageGate(
              useDeckStore.getState().deck!,
              design,
            );
            const hardMsgs = gate
              .filter((f) => f.severity === "hard")
              .map((f) =>
                localizeFinding(f, useSettingsStore.getState().settings.lang),
              );
            setFirstPageGateMsg(
              hardMsgs.length > 0
                ? t("chat.firstPageGateFailed", {
                    issues: hardMsgs.join("；"),
                  })
                : null,
            );
            if (isUntitledDeck(deck)) {
              const name = deriveProjectName(text);
              if (name) setTitle(name);
            }
          } else {
            generatedSlides.forEach((s) => addSlide(s));
          }

          addMessage(
            "assistant",
            t("chat.outlineGenerated", { count: generatedSlides.length }),
          );
        } else if (deck && deck.slides.length > 0) {
          // 已有 deck，优先 AI DeckPatch 编辑；失败/无 Key 时回退本地 intent-parser
          addMessage("assistant", t("chat.analyzing"));

          try {
            const result = await runJob(
              { type: "deck.patch", title: t("chat.apply"), canCancel: true },
              async (job) => {
                runningJobIdRef.current = job.id;
                try {
                  const patches = await generateDeckPatches({
                    deck,
                    userRequest: text,
                    signal: job.signal,
                  });
                  return {
                    kind: "patches" as const,
                    patches,
                    baseUpdatedAt: deck.updatedAt,
                  };
                  return { kind: "patches" as const, patches };
                } catch (e) {
                  if (job.signal.aborted) throw e;
                  // 本地兜底：用简单规则解析并执行（无 key / AI 失败场景）
                  const fallback = applyUserIntent(text);
                  if (fallback.action === "modify") {
                    job.update({ message: t("chat.localFallbackHandled") });
                    return { kind: "fallback" as const, reply: fallback.reply };
                  }
                  throw e;
                }
              },
            );

            if (result.kind === "fallback") {
              runQualityCheck();
              addMessage(
                "assistant",
                `${result.reply}\n\n${t("chat.localFallbackNote")}`,
              );
              return;
            }

            const patches = result.patches;
            if (!patches || patches.length === 0) {
              addMessage("assistant", t("chat.noChangesNeeded"));
            } else {
              const summary = summarizePatches(patches);
              const hasDestructive = patches.some((p) =>
                DESTRUCTIVE_OPS.has(p.op),
              );

              const summaryLines = [
                `📋 ${t("chat.detectedOps", {
                  count: patches.length,
                  title: summary.title,
                })}`,
                "",
                ...summary.details.map((d) => `- ${d}`),
              ];

              if (hasDestructive) {
                summaryLines.push("", t("chat.highRiskWarning"));
              }

              addMessage(
                "assistant",
                summaryLines.join("\n"),
                patches,
                summary.title,
                hasDestructive,
                undefined,
                result.baseUpdatedAt,
              );
            }
          } catch (e) {
            if ((e as Error).name === "AbortError") return;
            addMessage(
              "assistant",
              t("chat.applyFailed", { error: (e as Error).message }),
            );
          }
        } else {
          // 没有 deck，提示先生成
          addMessage("assistant", t("chat.emptyDeck"));
        }
      } catch (e) {
        addMessage(
          "assistant",
          t("chat.errorWithApiKey", {
            error: (e as Error).message || t("chat.unknownError"),
          }),
          undefined,
          undefined,
          undefined,
          true,
        );
      } finally {
        setLoading(false);
        submittingRef.current = false;
        runningJobIdRef.current = null;
        useGenerationFollowStore.getState().setPartialText("");
        useGenerationFollowStore.getState().setGeneratingIndex(null);
      }
    },
    [
      input,
      addMessage,
      replaceSlides,
      addSlide,
      setTitle,
      runQualityCheck,
      genOptions,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handlePresetGenerate = async (
    preset: DeckPreset,
    topic: string,
    slides: Slide[],
  ) => {
    const presetName = getPresetDisplay(
      preset,
      useSettingsStore.getState().settings.lang,
    ).name;
    try {
      await runJob(
        {
          type: "outline.generate",
          title: t("chat.generateFromTemplateJob", { name: presetName }),
          canCancel: false,
        },
        async () => {
          useDeckStore.getState().setDesign(preset.design);
          await replaceSlides(slides);
          useQualityStore.getState().setPendingRules(preset.qualityRules ?? []);
          runQualityCheck();
          const deck = useDeckStore.getState().deck;
          if (deck && isUntitledDeck(deck)) setTitle(topic);
        },
      );
      addMessage(
        "assistant",
        t("chat.regeneratedFromTemplate", {
          name: presetName,
          count: slides.length,
        }),
      );
    } catch (e) {
      addMessage(
        "assistant",
        t("chat.templateFailed", { error: (e as Error).message }),
      );
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-text-muted">
        <div>{t("chat.assistantTitle")}</div>
        <button
          onClick={() => setPresetOpen(true)}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-bg-hover hover:text-accent ${
            presetOpen ? "text-accent" : "text-text-muted"
          }`}
          title={t("chat.useTemplate")}
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          {t("chat.template")}
        </button>
      </div>

      <PresetPickerDialog
        open={presetOpen}
        onClose={() => setPresetOpen(false)}
        onGenerate={(params) =>
          handlePresetGenerate(params.preset, params.topic, params.slides)
        }
      />

      <div className="flex-1 overflow-auto px-4 py-2 text-sm">
        <div className="space-y-3">
          {qualityReport && (
            <QualityReport
              findings={qualityReport}
              fixing={fixing}
              onAutoFix={() => void handleAutoFix()}
              onDismiss={() => useQualityStore.getState().clear()}
              onVisualReview={() => void handleVisualReview()}
              visualReviewing={visualReviewing}
            />
          )}
          {firstPageGateMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="flex-1">
                <span className="font-medium">{t("chat.firstPageCheck")}</span>
                <p className="mt-0.5 leading-relaxed">{firstPageGateMsg}</p>
                <div className="mt-1.5 flex gap-2">
                  <button
                    onClick={() => void handleSubmit(lastUserText.current)}
                    className="rounded-md bg-warning/20 px-2 py-0.5 font-medium text-text-primary transition-colors hover:bg-warning/30"
                  >
                    {t("chat.regenerateFirstPage")}
                  </button>
                  <button
                    onClick={() => setFirstPageGateMsg(null)}
                    className="rounded-md border border-warning/40 px-2 py-0.5 text-warning transition-colors hover:bg-warning/10"
                  >
                    {t("chat.continueAfterAdjust")}
                  </button>
                </div>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`group relative rounded-lg px-3 py-2.5 ${
                msg.role === "user"
                  ? "bg-accent-soft/30 text-text-primary"
                  : "bg-bg-surface text-text-secondary"
              }`}
            >
              <button
                onClick={() => copyMessage(msg.id, msg.content)}
                className="absolute right-1.5 top-1.5 rounded p-1 text-text-muted opacity-0 transition-opacity hover:bg-bg-hover focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                title={t("chat.copyMessage")}
              >
                {copiedId === msg.id ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <div className="whitespace-pre-wrap text-inherit">
                {msg.content}
              </div>

              {/* Patch 确认按钮 */}
              {msg.patches && msg.patches.length > 0 && (
                <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
                  {msg.destructive && (
                    <div className="flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      {t("chat.highRisk")}
                    </div>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => applyPatches(msg)}
                    className="rounded-lg bg-gradient-to-r from-ai to-ai-hover px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 shadow-sm shadow-ai/20"
                  >
                    {t("chat.apply")}
                  </button>
                  <button
                    onClick={() => dismissPatches(msg.id)}
                    className="rounded-md border border-border px-3 py-1 text-xs text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              )}

              {/* 错误消息附带重试 */}
              {msg.role === "assistant" && msg.error && (
                <button
                  onClick={() => void handleSubmit(lastUserText.current)}
                  className="mt-2 flex items-center gap-1 rounded-md bg-accent/10 px-2.5 py-1 text-xs text-accent hover:bg-accent/20"
                >
                  <RefreshCw className="h-3 w-3" />
                  {t("common.retry")}
                </button>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("chat.thinking")}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 本地模型逐 token 实时输出（仅生成期间可见） */}
      <LocalLiveOutput />

      {/* 生成前参数控制（场景/语气/密度/受众/图表/页数） */}
      <GenerationOptionsBar
        open={showGenOptions}
        onToggle={() => setShowGenOptions((v) => !v)}
        options={genOptions}
        onChange={setGenOptions}
      />

      {/* 预制指令 */}
      {messages.length <= 1 && !loading && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-1">
          {[
            t("chat.suggestionAiIndustry"),
            t("chat.suggestionQ3Report"),
            t("chat.suggestionLaunch"),
            t("chat.suggestionMarketAnalysis"),
          ].map((text) => (
            <button
              key={text}
              onClick={() => {
                setInput(text);
                textareaRef.current?.focus();
              }}
              className="rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
            >
              {text}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.inputPlaceholder")}
            rows={1}
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {loading ? (
            <button
              type="button"
              onClick={stopActiveJob}
              title={t("chat.stopGenerating")}
              className="rounded-lg border border-border p-1.5 text-text-secondary transition-colors hover:border-danger/40 hover:text-danger"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              onClick={() => void handleSubmit()}
              disabled={!input.trim()}
              className="rounded-lg bg-gradient-to-r from-ai to-ai-hover p-1.5 text-white transition-opacity hover:opacity-90 disabled:opacity-40 shadow-sm shadow-ai/20"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** 本地模型逐 token 实时输出面板：仅在有增量时显示，自动滚到底 */
function LocalLiveOutput() {
  const t = useT();
  const partial = useGenerationFollowStore((s) => s.partialText);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [partial]);
  if (!partial) return null;
  return (
    <div className="mx-4 mb-2 rounded-lg border border-border bg-bg-elevated p-2">
      <div className="mb-1 text-xs text-text-muted">{t("chat.liveOutput")}</div>
      <div
        ref={boxRef}
        className="h-24 overflow-y-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-4 text-text-secondary"
      >
        {partial}
      </div>
    </div>
  );
}
