import { useState, useRef, useCallback } from "react";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { useDeckStore } from "@/store/deck";
import { generateOutline } from "@/services/outline";
import { applyUserIntent } from "@/services/intent-parser";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "你好！我可以帮你生成 PPT 大纲、填充内容。告诉我你想做什么主题的 PPT？",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyMessage = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { deck, replaceSlides, addSlide } = useDeckStore();

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role, content },
      ]);
    },
    [],
  );

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    addMessage("user", text);
    setLoading(true);

    try {
      // 检查是否包含主题相关的生成意图
      const isTopicRequest =
        /生成|创建|做一个|写一个|关于.*(PPT|幻灯片|汇报|报告)|主题/.test(text);

      if (isTopicRequest) {
        addMessage("assistant", "正在生成大纲，请稍候…");

        const slides = await generateOutline({
          topic: text,
          pageCount: deck?.slides.length ? undefined : 8,
        });

        if (deck) {
          await replaceSlides(slides);
        } else {
          // 如果没有 deck，依次添加
          slides.forEach((s) => addSlide(s));
        }

        addMessage(
          "assistant",
          `已生成 **${slides.length} 页大纲**！你可以：
1. 在左侧大纲面板拖拽调整顺序
2. 点击每页展开修改标题和布局
3. 告诉我想进一步调整哪里`,
        );
      } else {
        // 尝试解析本地意图（修改页面、新增、删除等）
        const { action, reply } = applyUserIntent(text);
        if (action === "modify") {
          addMessage("assistant", reply);
        } else {
          // 通用对话
          addMessage(
            "assistant",
            `好的，我收到了。你可以试试：

- **生成 PPT**：说"生成一份关于 AI 行业的PPT"
- **修改页面**：说"把第3页改成双栏"或"删掉第2页"
- **新增页面**：说"加一页市场分析"
- **导入文档**：点击工具栏的「导入」按钮`,
          );
        }
      }
    } catch (e) {
      addMessage(
        "assistant",
        `出错了：${(e as Error).message || "未知错误"}。请检查设置页的 API Key 是否正确配置。`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-text-muted">
        AI 助手
      </div>

      <div className="flex-1 overflow-auto px-4 py-2 text-sm">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`group relative rounded-lg px-3 py-2.5 ${
                msg.role === "user"
                  ? "bg-accent-soft/30 text-text-primary"
                  : "bg-bg-elevated text-text-secondary"
              }`}
            >
              <button
                onClick={() => copyMessage(msg.id, msg.content)}
                className="absolute right-1.5 top-1.5 rounded p-1 text-text-muted opacity-0 transition-opacity hover:bg-bg-hover group-hover:opacity-100"
                title="复制消息"
              >
                {copiedId === msg.id ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              思考中…
            </div>
          )}
        </div>
      </div>

      {/* 预制指令 */}
      {messages.length <= 1 && !loading && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-1">
          {[
            "生成一份关于AI行业的PPT",
            "Q3业务汇报",
            "产品发布会PPT",
            "市场分析报告",
          ].map((text) => (
            <button
              key={text}
              onClick={() => {
                setInput(text);
                textareaRef.current?.focus();
              }}
              className="rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
            >
              {text}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-bg-base px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入指令，如：生成一份 Q3 业务复盘汇报"
            rows={1}
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className="rounded-md bg-accent p-1.5 text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
