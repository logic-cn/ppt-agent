import type { ImportResult } from "./types";

export async function importMarkdown(
  file: File,
  text?: string,
): Promise<ImportResult> {
  const content = text ?? (await file.text());
  const { marked } = await import("marked");
  const tokens = marked.lexer(content);

  const sections: { heading: string; content: string }[] = [];
  let currentHeading = "正文";
  let currentContent: string[] = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n"),
        });
        currentContent = [];
      }
      currentHeading = token.text;
    } else if (token.type === "paragraph" || token.type === "list") {
      currentContent.push(token.raw);
    }
  }
  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n"),
    });
  }

  return {
    title: file.name.replace(/\.md$/i, ""),
    text: content,
    structured: { title: sections[0]?.heading ?? "文档", sections },
  };
}
