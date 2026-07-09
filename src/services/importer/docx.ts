import type { ImportResult, StructuredDoc } from "./types";

export async function importDocx(file: File): Promise<ImportResult> {
  const { extractRawText } = await import("mammoth");
  const buffer = await file.arrayBuffer();
  const result = await extractRawText({ arrayBuffer: buffer });
  const text = result.value;
  return {
    title: file.name.replace(/\.(docx|doc)$/i, ""),
    text,
    structured: structureText(text),
  };
}

function structureText(text: string): StructuredDoc {
  const lines = text.split("\n").filter(Boolean);
  const sections: { heading: string; content: string }[] = [];
  let currentHeading = "正文";
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      /^#{1,3}\s/.test(trimmed) ||
      /^[一二三四五六七八九十]+[、.．]/.test(trimmed)
    ) {
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n"),
        });
        currentContent = [];
      }
      currentHeading = trimmed.replace(/^#+\s*/, "");
    } else {
      currentContent.push(trimmed);
    }
  }
  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n"),
    });
  }

  return {
    title: sections[0]?.heading ?? "文档",
    sections,
  };
}
