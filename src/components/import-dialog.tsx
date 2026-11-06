import { useState, useRef, useEffect, useCallback } from "react";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import { Upload, Link, FileText, Loader2, X, Check } from "lucide-react";
import {
  importDocx,
  importMarkdown,
  importPdf,
  importUrl,
} from "@/services/importer";
import {
  parseDocument,
  getDocumentStrategy,
  generateOutlineFromDocument,
  prepareDocumentForOutline,
} from "@/services/importer";
import type { ParsedDocument } from "@/services/importer/types";
import { useDeckStore } from "@/store/deck";
import { useJobStore, runJob } from "@/store/job";
import { useQualityStore } from "@/store/quality";
import { useToastStore } from "@/store/toast";
import { checkDeckQuality } from "@/services/quality";
import { appendErrorSuggestion } from "@/services/error-suggest";
import { useT } from "@/hooks/use-page-t";

interface Props {
  open: boolean;
  onClose: () => void;
}

type ImportStep = "input" | "parsed" | "generating";

export function ImportDialog({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef);
  const t = useT();
  const [tab, setTab] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<ImportStep>("input");
  const [parsed, setParsed] = useState<ParsedDocument | null>(null);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [docStrategy, setDocStrategy] = useState<
    "direct" | "chunk_summary" | "select_sections"
  >("direct");
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceSlides = useDeckStore((s) => s.replaceSlides);
  const addToast = useToastStore((s) => s.add);
  // 记录正在进行的导入任务，便于在关闭/取消时终止后台生成
  const activeJobRef = useRef<string | null>(null);

  const cancelActiveJob = useCallback(() => {
    const id = activeJobRef.current;
    if (id) {
      useJobStore.getState().cancelJob(id);
      activeJobRef.current = null;
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (step === "generating") {
        cancelActiveJob();
        setStep("input");
        setParsed(null);
      } else if (step === "input") {
        onClose();
      } else {
        setStep("input");
        setParsed(null);
      }
    },
    [onClose, step],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  useEffect(() => {
    if (!open) {
      setStep("input");
      setParsed(null);
      setSelectedSectionIds([]);
      setImporting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleParseSuccess = async (input: {
    type: "docx" | "markdown" | "url" | "text" | "pdf";
    title: string;
    ref: string;
    rawText: string;
    sections: { heading: string; content: string; level?: number }[];
  }) => {
    const doc = parseDocument(input);
    const strategy = getDocumentStrategy(doc);
    setParsed(doc);
    setDocStrategy(strategy);
    setSelectedSectionIds(doc.sections.map((s) => s.id));

    // 用源标题命名 PPT 项目（URL 导入即网页标题；docx/markdown 即文档标题）
    const deck = useDeckStore.getState().deck;
    if (deck) {
      const name = input.title.trim();
      if (name) useDeckStore.getState().setTitle(name);
    }

    if (strategy === "direct") {
      await handleGenerate(
        doc,
        doc.sections.map((s) => s.id),
      );
    } else {
      // 长文档需用户确认章节后再生成，这里必须结束“解析中”状态，
      // 否则生成按钮会一直处于 loading 且被禁用
      setImporting(false);
      setStep("parsed");
    }
  };

  const handleGenerate = async (doc: ParsedDocument, selectedIds: string[]) => {
    setStep("generating");
    setImporting(true);

    try {
      const slides = await runJob(
        {
          type: "document.import",
          title: t("import.jobImportTitle", { title: doc.source.title }),
          canCancel: true,
        },
        async (job) => {
          activeJobRef.current = job.id;

          const context = await prepareDocumentForOutline(doc, {
            selectedSectionIds: selectedIds,
          });
          context.selectedSectionIds = selectedIds;

          job.update({ progress: 0.5, message: t("import.generatingOutline") });

          const result = await generateOutlineFromDocument(context, {
            signal: job.signal,
          });
          return result;
        },
      );

      activeJobRef.current = null;

      const deck = useDeckStore.getState().deck;
      if (deck) {
        await replaceSlides(slides);
        const current = useDeckStore.getState().deck;
        useQualityStore.getState().setReport(
          current
            ? checkDeckQuality(current, {
                // 直接导入时 parsed state 尚未提交，必须使用入参 doc
                sourceText: doc.rawText || undefined,
              })
            : null,
        );
      }

      addToast({
        type: "success",
        title: t("import.complete"),
        message: t("import.generatedPages", { count: slides.length }),
      });
      onClose();
    } catch (e) {
      activeJobRef.current = null;
      // 用户主动取消（Esc/点遮罩）时，弹框状态已被重置，不能再报错或回填 parsed
      if ((e as Error).name === "AbortError") {
        setImporting(false);
        return;
      }
      addToast({
        type: "error",
        title: t("import.failed"),
        message:
          (e as Error).message +
          appendErrorSuggestion((e as Error).message, (key) => t(key)),
      });
      setStep("parsed");
      setImporting(false);
    }
  };

  const handleFile = async (file: File) => {
    if (importing) return;
    setImporting(true);
    // 扩展名大小写不敏感：.MD / .PDF / .DOCX 同样应被接受
    const lowerName = file.name.toLowerCase();
    try {
      if (lowerName.endsWith(".docx")) {
        const result = await importDocx(file);
        await handleParseSuccess({
          type: "docx",
          title: result.title,
          ref: file.name,
          rawText: result.text,
          sections: result.structured.sections.map((s) => ({
            heading: s.heading,
            content: s.content,
            level: 1,
          })),
        });
      } else if (lowerName.endsWith(".pdf")) {
        const result = await importPdf(file);
        await handleParseSuccess({
          type: "pdf",
          title: result.title,
          ref: file.name,
          rawText: result.text,
          sections: result.structured.sections.map((s) => ({
            heading: s.heading,
            content: s.content,
            level: 1,
          })),
        });
      } else if (lowerName.endsWith(".md")) {
        const result = await importMarkdown(file);
        await handleParseSuccess({
          type: "markdown",
          title: result.title,
          ref: file.name,
          rawText: result.text,
          sections: result.structured.sections.map((s) => ({
            heading: s.heading,
            content: s.content,
            level: 1,
          })),
        });
      } else {
        addToast({
          type: "error",
          title: t("import.unsupportedFormat"),
          message: t("import.unsupportedFormatMsg"),
        });
        setImporting(false);
      }
    } catch (e) {
      addToast({
        type: "error",
        title: t("import.parseFailed"),
        message: (e as Error).message,
      });
      setImporting(false);
    }
  };

  const handleUrl = async () => {
    const u = url.trim();
    if (!u) return;

    setImporting(true);
    try {
      const result = await importUrl(u);
      await handleParseSuccess({
        type: "url",
        title: result.title,
        ref: u,
        rawText: result.text,
        sections: result.structured.sections.map((s) => ({
          heading: s.heading,
          content: s.content,
          level: 1,
        })),
      });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        addToast({
          type: "warning",
          title: t("import.urlUnreachable"),
          message: t("import.urlUnreachableMsg"),
        });
      } else {
        addToast({
          type: "error",
          title: t("import.failed"),
          message: msg,
        });
      }
      setImporting(false);
    }
  };

  const toggleSection = (id: string) => {
    setSelectedSectionIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const renderParsedPreview = () => {
    if (!parsed) return null;
    const totalChars = parsed.rawText.length;
    const strategyLabel =
      docStrategy === "direct"
        ? t("import.strategyDirect")
        : docStrategy === "chunk_summary"
          ? t("import.strategyChunk")
          : t("import.strategySelect");

    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-bg-surface p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-text-primary">
              {parsed.source.title}
            </span>
            <span className="text-xs text-text-muted">
              {t("import.charCount", {
                chars: totalChars,
                tokens: Math.ceil(totalChars / 4),
              })}
            </span>
          </div>
          <div className="text-xs text-text-muted">
            {t("import.strategyAndPages", {
              strategy: strategyLabel,
              pages: Math.max(5, Math.ceil(totalChars / 800)),
            })}
          </div>
          {parsed.warnings.length > 0 && (
            <div className="mt-2 text-xs text-warning">
              {parsed.warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}
        </div>

        {(docStrategy === "select_sections" ||
          docStrategy === "chunk_summary") &&
          parsed.sections.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs text-text-secondary">
                {t("import.selectSections", {
                  selected: selectedSectionIds.length,
                  total: parsed.sections.length,
                })}
              </label>
              <div className="max-h-48 space-y-1 overflow-auto">
                {parsed.sections.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-bg-hover"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSectionIds.includes(s.id)}
                      onChange={() => toggleSection(s.id)}
                      className="accent-accent"
                    />
                    <span className="flex-1 truncate text-text-primary">
                      {s.heading}
                    </span>
                    <span className="text-xs text-text-muted">
                      {t("import.charsShort", { count: s.content.length })}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => {
              setStep("input");
              setParsed(null);
            }}
            className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
          >
            {t("import.reselect")}
          </button>
          <button
            onClick={() => parsed && handleGenerate(parsed, selectedSectionIds)}
            disabled={importing || selectedSectionIds.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-accent-hover px-4 py-1.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {t("import.generatePpt")}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
      onClick={() => {
        if (step === "generating") {
          cancelActiveJob();
          setStep("input");
          setParsed(null);
        } else if (step === "input") {
          onClose();
        } else {
          setStep("input");
          setParsed(null);
        }
      }}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-bg-elevated shadow-xl animate-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="import-dialog-title" className="text-base font-semibold">
            {t("import.title")}
          </h2>
          <button
            onClick={
              step === "input"
                ? onClose
                : () => {
                    if (step === "generating") cancelActiveJob();
                    setStep("input");
                    setParsed(null);
                  }
            }
            className="rounded p-1 text-text-muted hover:bg-bg-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab 切换 */}
        {step === "input" && (
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab("file")}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm ${
                tab === "file"
                  ? "border-b-2 border-accent text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <Upload className="h-4 w-4" />
              {t("import.uploadFile")}
            </button>
            <button
              onClick={() => setTab("url")}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm ${
                tab === "url"
                  ? "border-b-2 border-accent text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <Link className="h-4 w-4" />
              {t("import.webLink")}
            </button>
          </div>
        )}

        {/* 内容 */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === "input" && tab === "file" ? (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition ${
                dragOver
                  ? "border-accent bg-accent-soft/20"
                  : "border-border hover:border-accent hover:bg-accent-soft/10"
              }`}
            >
              <FileText className="h-10 w-10 text-text-muted" />
              <div>
                <p className="font-medium text-text-primary">
                  {t("import.uploadHint")}
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  {t("import.uploadFormats")}
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,.md,.pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  // 清空 value，允许解析失败后重新选择同一个文件
                  e.target.value = "";
                  if (f) void handleFile(f);
                }}
                className="hidden"
              />
            </div>
          ) : step === "input" && tab === "url" ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm text-text-secondary">
                  {t("import.webLink")}
                </label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                />
              </div>
              <p className="text-xs text-text-muted">{t("import.urlNote")}</p>
              <button
                onClick={handleUrl}
                disabled={importing || !url.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-accent-hover px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("import.parseAndImport")}
              </button>
            </div>
          ) : step === "parsed" || step === "generating" ? (
            renderParsedPreview()
          ) : null}
        </div>

        {/* 底部（input 模式显示） */}
        {step === "input" && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
            >
              {t("common.cancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
