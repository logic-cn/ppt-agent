import type { Deck, Slide } from "@/types/deck";

export function createMockDeck(): Deck {
  const now = Date.now();
  const slides: Slide[] = [
    {
      id: "s1",
      layout: "cover",
      title: "Q3 业务复盘汇报",
      subtitle: "增长 · 效率 · 展望",
    },
    {
      id: "s2",
      layout: "section",
      title: "核心成果",
      subtitle: "本季度关键指标概览",
    },
    {
      id: "s3",
      layout: "content",
      title: "业务增长亮点",
      bullets: [
        {
          id: "b1",
          text: "营收同比增长 32%，超额完成季度目标",
          level: 0,
          children: [
            {
              id: "b1a",
              text: "核心产品线贡献增长 45%",
              level: 1,
            },
            {
              id: "b1b",
              text: "新客户获取成本下降 18%",
              level: 1,
            },
          ],
        },
        {
          id: "b2",
          text: "用户活跃度提升至日均 120 万",
          level: 0,
        },
        {
          id: "b3",
          text: "客户留存率达到 87%，创历史新高",
          level: 0,
        },
      ],
    },
    {
      id: "s4",
      layout: "chart",
      title: "季度营收对比",
      chart: {
        type: "bar",
        title: "2024 年各季度营收（万元）",
        data: [
          { label: "Q1", value: 280 },
          { label: "Q2", value: 320 },
          { label: "Q3", value: 420 },
          { label: "Q4", value: 510 },
        ],
      },
    },
    {
      id: "s5",
      layout: "two-column",
      title: "产品策略复盘",
      bullets: [
        {
          id: "b5a",
          text: "新功能上线节奏稳定",
          level: 0,
        },
        {
          id: "b5b",
          text: "用户反馈响应速度提升",
          level: 0,
        },
        {
          id: "b5c",
          text: "技术债清理进展顺利",
          level: 0,
        },
      ],
      image: {
        type: "icon",
        alt: "策略示意图",
        position: "right",
      },
    },
    {
      id: "s6",
      layout: "closing",
      title: "感谢聆听",
      subtitle: "期待 Q4 再创佳绩",
    },
  ];

  return {
    id: "mock-demo",
    title: "Q3 业务复盘汇报（示例）",
    themeId: "business-blue",
    slides,
    createdAt: now,
    updatedAt: now,
    source: { type: "topic", ref: "Q3 业务复盘" },
  };
}
