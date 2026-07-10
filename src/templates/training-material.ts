import type { Template } from "@/types/template";

export const trainingMaterial: Template = {
  id: "training-material",
  name: "培训课件",
  description: "适合内部培训、知识分享、新人 onboarding",
  scenario: "training",
  suggestedTheme: "business-blue",
  suggestedPageCount: 10,
  slides: [
    {
      layout: "cover",
      title: "培训主题",
      subtitle: "讲师姓名 | 部门 | 日期",
    },
    {
      layout: "content",
      title: "课程目标",
      bullets: [
        { text: "了解 XX 基本概念与原理", level: 0 },
        { text: "掌握 XX 核心技能与方法", level: 0 },
        { text: "能够独立完成 XX 实操", level: 0 },
      ],
    },
    {
      layout: "content",
      title: "课程大纲",
      bullets: [
        { text: "第一章：XX 概述", level: 0 },
        { text: "第二章：XX 核心知识", level: 0 },
        { text: "第三章：实操演练", level: 0 },
        { text: "第四章：常见问题", level: 0 },
        { text: "第五章：总结与考核", level: 0 },
      ],
    },
    {
      layout: "section",
      title: "第一章：概述",
    },
    {
      layout: "content",
      title: "什么是 XX",
      body: "此处填写基本概念的定义、发展历程和重要性。建议结合实际案例进行说明，帮助学员建立直观认知。",
    },
    {
      layout: "section",
      title: "第二章：核心知识",
    },
    {
      layout: "cols-4",
      title: "知识要点",
      items: [
        { title: "要点一", bullets: ["核心概念", "关键方法"] },
        { title: "要点二", bullets: ["核心概念", "关键方法"] },
        { title: "要点三", bullets: ["核心概念", "关键方法"] },
        { title: "要点四", bullets: ["核心概念", "关键方法"] },
      ],
    },
    {
      layout: "two-column",
      title: "对比分析",
      bullets: [
        {
          text: "方法A",
          level: 0,
          children: [
            { text: "优点：XX", level: 1 },
            { text: "缺点：XX", level: 1 },
            { text: "适用场景：XX", level: 1 },
          ],
        },
        {
          text: "方法B",
          level: 0,
          children: [
            { text: "优点：XX", level: 1 },
            { text: "缺点：XX", level: 1 },
            { text: "适用场景：XX", level: 1 },
          ],
        },
      ],
      image: { type: "icon", alt: "对比图" },
    },
    {
      layout: "section",
      title: "第三章：实操演练",
    },
    {
      layout: "content",
      title: "演练步骤",
      bullets: [
        { text: "步骤一：准备工作", level: 0 },
        { text: "步骤二：核心操作", level: 0 },
        { text: "步骤三：验证结果", level: 0 },
        { text: "步骤四：常见问题排查", level: 0 },
      ],
    },
    {
      layout: "closing",
      title: "谢谢参与",
      subtitle: "Q&A",
    },
  ],
};
