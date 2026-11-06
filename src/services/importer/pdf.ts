/**
 * PDF 导入（B6）：pdfjs-dist 逐页抽取文本 → 按字号启发式识别标题 → 结构化章节。
 * 依赖动态加载，测试中以 mock 注入；仅抽取文本层，扫描件（无文本层）给出警告。
 */

import type { ImportResult } from "./types";
import { MAX_IMPORT_FILE_BYTES } from "./limits";
import { t } from "@/services/i18n";

interface TextItemLike {
  str: string;
  transform: number[];
}

interface PdfPageLike {
  getTextContent: () => Promise<{ items: TextItemLike[] }>;
}

interface PdfDocLike {
  numPages: number;
  getPage: (n: number) => Promise<PdfPageLike>;
  getMetadata?: () => Promise<{ info?: { Title?: string } }>;
}

interface PdfjsModule {
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PdfDocLike> };
  GlobalWorkerOptions?: { workerSrc: string };
}

/** 动态加载 pdfjs（vite worker；测试 mock 整个模块） */
async function loadPdfjs(): Promise<PdfjsModule> {
  const pdfjs = (await import("pdfjs-dist")) as unknown as PdfjsModule;
  if (pdfjs.GlobalWorkerOptions) {
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
    } catch {
      // 非打包环境下保留默认（fake worker）
    }
  }
  return pdfjs;
}

interface Line {
  text: string;
  size: number;
  page: number;
}

/** 把一页的 text item 按基线 y 聚合成行，行字号取该行最大 item 字号 */
function itemsToLines(items: TextItemLike[], page: number): Line[] {
  const rows = new Map<number, { text: string[]; size: number }>();
  for (const item of items) {
    if (!item.str.trim()) continue;
    // transform: [a, b, c, d, e, f]，f 为基线 y，a 近似字号
    const y = Math.round(item.transform[5] ?? 0);
    const size = Math.abs(item.transform[0] ?? 0) || 1;
    const row = rows.get(y);
    if (row) {
      row.text.push(item.str);
      row.size = Math.max(row.size, size);
    } else {
      rows.set(y, { text: [item.str], size });
    }
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0]) // PDF 坐标系 y 向上，行序自上而下
    .map(([, row]) => ({
      text: row.text.join("").replace(/\s+/g, " ").trim(),
      size: row.size,
      page,
    }))
    .filter((l) => l.text);
}

/** 标题启发式：行字号 > 全文中位数 × 1.25 判为标题 */
function isHeadingLine(line: Line, medianSize: number): boolean {
  return line.size > medianSize * 1.25 && line.text.length <= 80;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** 把行序列切成章节：标题行开新章节，正文行累积 */
export function linesToSections(
  lines: Line[],
  medianSize: number,
): { heading: string; content: string }[] {
  const sections: { heading: string; content: string }[] = [];
  let heading = "正文";
  let content: string[] = [];
  const flush = () => {
    if (content.length > 0) {
      sections.push({ heading, content: content.join("\n") });
      content = [];
    }
  };
  for (const line of lines) {
    if (isHeadingLine(line, medianSize)) {
      flush();
      heading = line.text;
    } else {
      content.push(line.text);
    }
  }
  flush();
  return sections;
}

export async function importPdf(file: File): Promise<ImportResult> {
  // 大小上限：超大 PDF 逐页解析既慢又占内存，明确报错优于无响应
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error(
      t("import.warnPdfTooLarge", {
        size: (file.size / 1024 / 1024).toFixed(0),
        limit: MAX_IMPORT_FILE_BYTES / 1024 / 1024,
      }),
    );
  }
  const pdfjs = await loadPdfjs();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;

  const lines: Line[] = [];
  const warnings: string[] = [];
  let firstPageText = "";
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    const pageLines = itemsToLines(items, n);
    if (n === 1) firstPageText = pageLines.map((l) => l.text).join("\n");
    if (pageLines.length === 0 && n === 1) {
      warnings.push(t("import.warnScannedPdf"));
    }
    lines.push(...pageLines);
  }

  const title =
    firstPageText.split("\n")[0]?.slice(0, 40) ||
    file.name.replace(/\.pdf$/i, "");
  const medianSize = median(lines.map((l) => l.size));
  const sections = linesToSections(lines, medianSize);
  if (sections.length === 0) {
    warnings.push(t("import.warnNoSections"));
  }

  const text = lines.map((l) => l.text).join("\n");
  return {
    title,
    text,
    structured: { title, sections },
  };
}
