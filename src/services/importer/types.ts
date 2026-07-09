export interface StructuredDoc {
  title: string;
  sections: { heading: string; content: string }[];
}

export interface ImportResult {
  title: string;
  text: string;
  structured: StructuredDoc;
}
