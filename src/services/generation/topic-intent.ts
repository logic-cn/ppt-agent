/**
 * 用户消息意图识别（纯函数，便于单测）。
 * 判断是否包含「生成/创建 PPT」的主题请求意图。
 */
const TOPIC_REQUEST_RE =
  /生成|创建|做一个|写一个|关于.*(PPT|幻灯片|汇报|报告)|主题/;

export function isTopicRequest(text: string): boolean {
  return TOPIC_REQUEST_RE.test(text);
}

/** 从未命名项目下由主题请求文本推导项目名称 */
export function deriveProjectName(text: string): string {
  return text
    .replace(/^(生成|创建|做一个|写一个|关于)\s*/, "")
    .replace(/一份|一个|一篇/, "")
    .replace(/^关于/, "")
    .replace(/[的]?(PPT|幻灯片|汇报|报告|主题)\s*$/, "")
    .trim();
}
