import { useState, useRef, useCallback, useEffect } from "react";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  LayoutTemplate,
} from "lucide-react";
import { useDeckStore } from "@/store/deck";
import { runJob } from "@/store/job";
import { useQualityStore } from "@/store/quality";
import { buildDeckSvgs } from "@/engine/svg/pipeline";
import { runFirstPageGate } from "@/services/generation/first-page-gate";
import {
  isTopicRequest,
  deriveProjectName,
} from "@/services/generation/topic-intent";
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
import type { DeckPreset } from "@/types/preset";
import type { Slide } from "@/types/deck";
import { PresetPickerDialog } from "@/components/preset/PresetPickerDialog";
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

  const addMessage = useCallback(
    (
      role: "user" | "assistant",
      content: string,
      patches?: DeckPatch[],
      summary?: string,
      destructive?: boolean,
      error?: boolean,
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
        },
      ]);
    },
    [],
  );

  const applyPatches = useCallback(
    (msg: Message) => {
      const deck = useDeckStore.getState().deck;
      if (!msg.patches || !deck) return;
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
    [replaceSlides, setTitle, addMessage],
  );

  // 生成完成后跑一次质量检查，并把报告写入全局 store
  // 若 pendingRules 存在（来自模板），则作为模板质量规则一并检查
  const runQualityCheck = useCallback(() => {
    const current = useDeckStore.getState().deck;
    const qualityStore = useQualityStore.getState();
    const rules = qualityStore.pendingRules ?? undefined;
    qualityStore.clearPendingRules();
    qualityStore.setReport(
      current ? checkDeckQuality(current, { rules }) : null,
    );
  }, []);

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

      try {
        // 检查是否包含主题相关的生成意图
        const isTopic = isTopicRequest(text);

        if (isTopic) {
          // 通过 runJob 统一封装 job 生命周期（生成大纲）
          addMessage("assistant", t("chat.generatingOutline"));

          let slides;
          try {
            slides = await runJob(
              {
                type: "outline.generate",
                title: t("chat.generateOutline"),
                canCancel: true,
              },
              async (job) => {
                // X1 管线：用 buildDeckSvgs 生成 svg 设计真相
                const targetDeck =
                  deck ?? (await useDeckStore.getState().createDeck());
                const newDeck = await buildDeckSvgs(
                  targetDeck,
                  deck?.design ?? DEFAULT_DESIGN,
                  {
                    topic: text,
                    pageCount: deck?.slides.length ? undefined : 8,
                    signal: job.signal,
                  },
                );
                return newDeck.slides;
              },
            );
          } catch {
            return;
          }

          if (deck) {
            await replaceSlides(slides);
            runQualityCheck();
            // 首屏风格锚点：仅检查首屏，hard 问题以横幅提示，不阻断生成
            const design = deck.design ?? DEFAULT_DESIGN;
            const gate = runFirstPageGate(
              useDeckStore.getState().deck!,
              design,
            );
            const hardMsgs = gate
              .filter((f) => f.severity === "hard")
              .map((f) => f.message);
            setFirstPageGateMsg(
              hardMsgs.length > 0
                ? t("chat.firstPageGateFailed", {
                    issues: hardMsgs.join("；"),
                  })
                : null,
            );
            if (deck.title === "未命名项目") {
              const name = deriveProjectName(text);
              if (name) setTitle(name);
            }
          } else {
            slides.forEach((s) => addSlide(s));
          }

          addMessage(
            "assistant",
            t("chat.outlineGenerated", { count: slides.length }),
          );
        } else if (deck && deck.slides.length > 0) {
          // 已有 deck，优先 AI DeckPatch 编辑；失败/无 Key 时回退本地 intent-parser
          addMessage("assistant", t("chat.analyzing"));

          try {
            const result = await runJob(
              { type: "deck.patch", title: t("chat.apply"), canCancel: true },
              async (job) => {
                try {
                  const patches = await generateDeckPatches({
                    deck,
                    userRequest: text,
                    signal: job.signal,
                  });
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
      }
    },
    [input, addMessage, replaceSlides, addSlide, setTitle, runQualityCheck],
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
    try {
      await runJob(
        {
          type: "outline.generate",
          title: t("chat.generateFromTemplateJob", { name: preset.name }),
          canCancel: false,
        },
        async () => {
          useDeckStore.getState().setDesign(preset.design);
          await replaceSlides(slides);
          useQualityStore.getState().setPendingRules(preset.qualityRules ?? []);
          runQualityCheck();
          const deck = useDeckStore.getState().deck;
          if (deck && deck.title === "未命名项目") setTitle(topic);
        },
      );
      addMessage(
        "assistant",
        t("chat.regeneratedFromTemplate", {
          name: preset.name,
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
      <div className="flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
        <span>{t("chat.assistantTitle")}</span>
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
            />
          )}
          {firstPageGateMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="flex-1">
                <span className="font-medium">{t("chat.firstPageCheck")}</span>
                <p className="mt-0.5 leading-relaxed">{firstPageGateMsg}</p>
                <div className="mt-1.5 flex gap-2">
                  <button
                    onClick={() => void handleSubmit(lastUserText.current)}
                    className="rounded-md bg-amber-100 px-2 py-0.5 font-medium text-amber-800 hover:bg-amber-200"
                  >
                    {t("chat.regenerateFirstPage")}
                  </button>
                  <button
                    onClick={() => setFirstPageGateMsg(null)}
                    className="rounded-md border border-amber-300 px-2 py-0.5 text-amber-700 hover:bg-amber-100"
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
                className="absolute right-1.5 top-1.5 rounded p-1 text-text-muted opacity-0 transition-opacity hover:bg-bg-hover group-hover:opacity-100"
                title={t("chat.copyMessage")}
              >
                {copiedId === msg.id ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-inherit">
                {msg.content}
              </div>

              {/* Patch 确认按钮 */}
              {msg.patches && msg.patches.length > 0 && (
                <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
                  {msg.destructive && (
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <AlertTriangle className="h-3 w-3" />
                      {t("chat.highRisk")}
                    </div>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => applyPatches(msg)}
                    className="rounded-lg bg-gradient-to-r from-ai to-orange-400 px-3 py-1 text-xs font-medium text-white hover:opacity-90 shadow-sm shadow-ai/20"
                  >
                    {t("chat.apply")}
                  </button>
                  <button className="rounded-md border border-border px-3 py-1 text-xs text-text-muted hover:bg-bg-hover">
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
          <button
            onClick={() => void handleSubmit()}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-gradient-to-r from-ai to-orange-400 p-1.5 text-white hover:opacity-90 disabled:opacity-40 shadow-sm shadow-ai/20"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
