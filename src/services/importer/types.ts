export interface StructuredDoc {
  title: string;
  sections: { heading: string; content: string }[];
}

export interface ImportResult {
  title: string;
  text: string;
  structured: StructuredDoc;
}

// --- 文档导入增强类型 ---

export type DocumentSourceType = "docx" | "markdown" | "url" | "text" | "pdf";

export interface DocumentSource {
  id: string;
  type: DocumentSourceType;
  title: string;
  ref: string;
  importedAt: number;
}

export interface DocumentSection {
  id: string;
  heading: string;
  level: number;
  content: string;
  order: number;
}

export interface KeyFact {
  id: string;
  text: string;
  value?: number;
  unit?: string;
  sourceChunkId: string;
}

export interface DocumentChunk {
  id: string;
  sectionId: string;
  text: string;
  tokenEstimate: number;
  summary?: string;
  keyFacts?: KeyFact[];
}

export interface ParsedDocument {
  source: DocumentSource;
  sections: DocumentSection[];
  rawText: string;
  warnings: string[];
}

export interface DocumentOutlineContext {
  source: DocumentSource;
  selectedSectionIds: string[];
  chunks: DocumentChunk[];
  summary: string;
  keyFacts: KeyFact[];
}

export interface ImportInput {
  type: DocumentSourceType;
  title: string;
  ref: string;
  rawText: string;
  sections: { heading: string; content: string; level?: number }[];
}

export interface DocumentPrepareOptions {
  selectedSectionIds?: string[];
}
