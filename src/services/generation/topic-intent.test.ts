import { describe, it, expect } from "vitest";
import { isTopicRequest, deriveProjectName } from "./topic-intent";

describe("isTopicRequest", () => {
  it("主题生成请求被识别", () => {
    expect(isTopicRequest("生成一份关于 AI 行业的 PPT")).toBe(true);
    expect(isTopicRequest("帮我创建一个季度汇报")).toBe(true);
    expect(isTopicRequest("写一个关于数据分析的报告")).toBe(true);
    expect(isTopicRequest("关于智能制造的幻灯片")).toBe(true);
    expect(isTopicRequest("Q3 业务复盘主题")).toBe(true);
  });

  it("修改/闲聊指令不被识别为生成请求", () => {
    expect(isTopicRequest("把第二页标题改一下")).toBe(false);
    expect(isTopicRequest("你好")).toBe(false);
    expect(isTopicRequest("删掉第三页")).toBe(false);
  });
});

describe("deriveProjectName", () => {
  it("剥离生成前缀与主题后缀", () => {
    expect(deriveProjectName("生成一份关于AI行业的PPT")).toBe("AI行业");
    expect(deriveProjectName("做一个 Q3 业务复盘汇报")).toBe("Q3 业务复盘");
    expect(deriveProjectName("关于数字化转型的汇报")).toBe("数字化转型");
  });

  it("无前后缀时保留原文", () => {
    expect(deriveProjectName("AI 行业分析")).toBe("AI 行业分析");
  });
});
