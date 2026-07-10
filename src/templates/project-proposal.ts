import type { Template } from "@/types/template";

export const projectProposal: Template = {
  id: "project-proposal",
  name: "项目立项汇报",
  description: "适合新项目立项、资源申请与目标对齐",
  scenario: "proposal",
  suggestedTheme: "business-blue",
  suggestedPageCount: 9,
  slides: [
    {
      layout: "cover",
      title: "{项目名称}立项汇报",
      subtitle: "汇报人 | 日期",
    },
    {
      layout: "content",
      title: "项目背景",
      bullets: [
        { text: "业务痛点与机会", level: 0 },
        { text: "战略契合度", level: 0 },
        { text: "为什么要现在做", level: 0 },
      ],
    },
    {
      layout: "content",
      title: "目标与价值",
      bullets: [
        { text: "业务目标：可量化的指标", level: 0 },
        { text: "用户价值：解决什么痛点", level: 0 },
        { text: "商业价值：营收/成本/效率", level: 0 },
      ],
    },
    {
      layout: "chart",
      title: "预期收益",
      chart: {
        type: "bar",
        title: "投入产出预测",
        data: [
          { label: "Q1", value: 20 },
          { label: "Q2", value: 45 },
          { label: "Q3", value: 80 },
          { label: "Q4", value: 120 },
        ],
      },
    },
    {
      layout: "section",
      title: "方案概览",
    },
    {
      layout: "cols-3",
      title: "关键举措",
      items: [
        {
          title: "阶段一",
          bullets: ["里程碑一", "关键交付物"],
        },
        {
          title: "阶段二",
          bullets: ["里程碑二", "关键交付物"],
        },
        {
          title: "阶段三",
          bullets: ["里程碑三", "关键交付物"],
        },
      ],
    },
    {
      layout: "content",
      title: "资源需求",
      bullets: [
        { text: "人力：XX 人 / 角色", level: 0 },
        { text: "预算：XX 万元", level: 0 },
        { text: "技术/数据支持", level: 0 },
      ],
    },
    {
      layout: "content",
      title: "风险与应对",
      bullets: [
        { text: "风险一：描述与缓解", level: 0 },
        { text: "风险二：描述与缓解", level: 0 },
      ],
    },
    {
      layout: "closing",
      title: "申请立项",
      subtitle: "期待与各方协同推进",
    },
  ],
};
