import type { BulletNode } from "@/types/deck";
import type { Theme } from "@/types/theme";

interface Props {
  bullets: BulletNode[];
  theme: Theme;
  maxLevel?: number;
}

/** 渲染嵌套 bullets 列表 */
export function BulletList({ bullets, theme, maxLevel = 2 }: Props) {
  const renderNodes = (nodes: BulletNode[], level: number) => {
    if (level > maxLevel) return null;
    const fontSize =
      level === 0
        ? theme.fontSize.body
        : level === 1
          ? theme.fontSize.body - 2
          : theme.fontSize.caption;
    const color = level === 0 ? theme.colors.text : theme.colors.textMuted;
    const bulletChar = level === 0 ? "●" : level === 1 ? "○" : "▪";

    return (
      <ul className="list-none space-y-2" style={{ margin: 0, padding: 0 }}>
        {nodes.map((node) => (
          <li
            key={node.id}
            style={{
              fontSize: `${fontSize}px`,
              color,
              lineHeight: 1.5,
              paddingLeft: level > 0 ? `${level * 16}px` : 0,
            }}
          >
            <span
              style={{
                color: theme.colors.accent,
                marginRight: "8px",
              }}
            >
              {bulletChar}
            </span>
            <span>{node.text}</span>
            {node.children && node.children.length > 0 && (
              <div style={{ marginTop: "4px" }}>
                {renderNodes(node.children, level + 1)}
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return <>{renderNodes(bullets, 0)}</>;
}
