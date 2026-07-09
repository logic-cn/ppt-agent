import type { BulletNode } from "@/types/deck";
import type { Theme } from "@/types/theme";

interface Props {
  bullets: BulletNode[];
  theme: Theme;
  scale?: number;
  maxLevel?: number;
}

export function BulletList({ bullets, theme, scale = 1, maxLevel = 2 }: Props) {
  const renderNodes = (nodes: BulletNode[], level: number) => {
    if (level > maxLevel) return null;
    const baseSize =
      level === 0
        ? theme.fontSize.body
        : level === 1
          ? theme.fontSize.body - 2
          : theme.fontSize.caption;
    const fontSize = baseSize * scale;
    const color = level === 0 ? theme.colors.text : theme.colors.textMuted;
    const bulletChar = level === 0 ? "●" : level === 1 ? "○" : "▪";

    return (
      <ul style={{ margin: 0, padding: 0 }}>
        {nodes.map((node, i) => (
          <li
            key={node.id}
            style={{
              fontSize: `${fontSize}px`,
              color,
              lineHeight: 1.6,
              paddingLeft: level > 0 ? `${level * 12 * scale}px` : 0,
              marginBottom: i < nodes.length - 1 ? `${6 * scale}px` : undefined,
            }}
          >
            <span
              style={{
                color: theme.colors.accent,
                marginRight: `${6 * scale}px`,
              }}
            >
              {bulletChar}
            </span>
            <span>{node.text}</span>
            {node.children && node.children.length > 0 && (
              <div style={{ marginTop: `${4 * scale}px` }}>
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
