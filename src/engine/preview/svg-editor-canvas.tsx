import { useEffect, useRef, useState, useCallback } from "react";
import { useT } from "@/hooks/use-page-t";

/**
 * 预览原位编辑画布（V1，参照 PPT Master svg_editor 的 Direct Edit 内核）：
 * - 点击选中顶层元素（右键列出指针下的重叠元素供挑选）
 * - 拖拽移动（指针位移经 CTM 逆映射到 viewBox 坐标，任意缩放跟手）
 * - 方向键微调 1px / Shift 10px（连续微调合并为一次历史）
 * - 浮层 mini-inspector：文字内容 / 字号 / 填充色 + 「AI 修改此元素」批注流
 * 写回：编辑发生在解析后的活 DOM 上，serialize 后剥离临时 data-pe-id，
 * 确定性写回 slide.svg（走全局 undo/redo，不经 LLM）。
 */

export interface ElementContext {
  peId: string;
  tag: string;
  text: string;
  bbox: { x: number; y: number; w: number; h: number } | null;
  /** 元素的序列化标记（已剥离临时 id），批注流注入给 LLM 定位 */
  markup: string;
}

/** 命中测试：优先浏览器 elementsFromPoint（含重叠栈）；环境缺失时从事件目标沿祖先找 */
function hitTest(
  e: { clientX: number; clientY: number; target: EventTarget | null },
  root: SVGSVGElement,
): Element[] {
  if (typeof document.elementsFromPoint === "function") {
    return document
      .elementsFromPoint(e.clientX, e.clientY)
      .filter((el) => el !== root && el.getAttribute?.(PE_ATTR));
  }
  let cur: Element | null = (e.target as Element) ?? null;
  while (cur && cur !== root) {
    if (cur.getAttribute?.(PE_ATTR)) return [cur];
    cur = cur.parentElement;
  }
  return [];
}

interface Props {
  svg: string;
  /** 确定性写回（进全局 undo 历史） */
  onUpdate: (svg: string) => void;
  /** V1.5 批注流：携带元素上下文的 AI 定向修改 */
  onAnnotate?: (instruction: string, ctx: ElementContext) => void;
  className?: string;
}

const PE_ATTR = "data-pe-id";

/** 剥离写回产物中的临时编辑标记 */
export function stripPeIds(svg: string): string {
  return svg.replace(new RegExp(`\\s*${PE_ATTR}="pe-\\d+"`, "g"), "");
}

/** 解析 SVG 并为顶层元素注入临时编辑 id；解析失败返回 null */
function parseAndTag(
  svg: string,
): { root: SVGSVGElement; topIds: string[] } | null {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (
    root.nodeName.toLowerCase() !== "svg" ||
    root.getElementsByTagName("parsererror").length > 0
  ) {
    return null;
  }
  const ids: string[] = [];
  Array.from(root.children).forEach((child, i) => {
    if (child.nodeName.toLowerCase() === "defs") return;
    const id = `pe-${i}`;
    child.setAttribute(PE_ATTR, id);
    ids.push(id);
  });
  return { root: root as unknown as SVGSVGElement, topIds: ids };
}

/** 屏幕位移 → viewBox 位移（CTM 逆映射；jsdom/异常时按宽度比例兜底） */
function screenToViewBox(
  root: SVGSVGElement,
  dx: number,
  dy: number,
): { dx: number; dy: number } {
  try {
    const ctm = root.getScreenCTM();
    if (ctm) {
      const p = new DOMPoint(dx, dy).matrixTransform(ctm.inverse());
      return { dx: p.x, dy: p.y };
    }
  } catch {
    // fallthrough
  }
  // 兜底：viewBox 与客户区等比（保持纵横比缩放）
  const vb = root.viewBox?.baseVal;
  const clientW = root.clientWidth || vb?.width || 1280;
  const vbW = vb?.width || 1280;
  const k = vbW / clientW;
  return { dx: dx * k, dy: dy * k };
}

function elementContext(el: Element): ElementContext {
  const peId = el.getAttribute(PE_ATTR) ?? "";
  const bbox = (() => {
    try {
      const b = (el as SVGGraphicsElement).getBBox();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    } catch {
      return null;
    }
  })();
  return {
    peId,
    tag: el.nodeName.toLowerCase(),
    text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
    bbox,
    markup: stripPeIds(
      new XMLSerializer().serializeToString(el),
    ).slice(0, 800),
  };
}

export function SvgEditorCanvas({ svg, onUpdate, onAnnotate, className }: Props) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<SVGSVGElement | null>(null);
  const parseFailed = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overlapMenu, setOverlapMenu] = useState<
    { id: string; label: string }[] | null
  >(null);
  const [tick, setTick] = useState(0); // 选中元素属性变化后刷新面板
  const lastCommitted = useRef<string | null>(null);
  const dragState = useRef<{
    el: Element;
    startX: number;
    startY: number;
    origTransform: string | null;
    moved: boolean;
  } | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 解析 + 注入 id + 上屏（svg 变化或组件挂载时重建；
  // 自身 commit 触发的 svg 更新跳过——活 DOM 已是最新，且保留选中态）
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (svg === lastCommitted.current) {
      lastCommitted.current = null;
      return;
    }
    const parsed = parseAndTag(svg);
    if (!parsed) {
      parseFailed.current = true;
      host.replaceChildren();
      return;
    }
    parseFailed.current = false;
    rootRef.current = parsed.root;
    setSelectedId(null);
    host.replaceChildren(parsed.root);
  }, [svg]);

  // 选中高亮：在活 DOM 上标记 data-selected（样式走 CSS 属性选择器）
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root
      .querySelectorAll(`[${PE_ATTR}][data-selected]`)
      .forEach((el) => el.removeAttribute("data-selected"));
    if (selectedId) {
      root
        .querySelector(`[${PE_ATTR}="${selectedId}"]`)
        ?.setAttribute("data-selected", "");
    }
  }, [selectedId, tick]);

  const selectedEl = selectedId
    ? rootRef.current?.querySelector(`[${PE_ATTR}="${selectedId}"]`) ?? null
    : null;

  /** serialize 当前 DOM 并确定性写回（进 undo 历史） */
  const commit = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const out = stripPeIds(new XMLSerializer().serializeToString(root));
    lastCommitted.current = out;
    onUpdate(out);
  }, [onUpdate]);

  /** 对选中元素叠加 translate（拖拽/微调共用；预乘即在父坐标系整体平移） */
  const applyTranslate = useCallback(
    (el: Element, dx: number, dy: number, fromOrig: string | null) => {
      const next =
        dx === 0 && dy === 0
          ? fromOrig
          : `translate(${Math.round(dx * 100) / 100} ${Math.round(dy * 100) / 100})${fromOrig ? ` ${fromOrig}` : ""}`;
      if (next === null) el.removeAttribute("transform");
      else el.setAttribute("transform", next);
    },
    [],
  );

  // ---- 指针：点选 / 右键重叠菜单 / 拖拽 ----
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const host = hostRef.current;
      const root = rootRef.current;
      if (!host || !root) return;
      const stack = hitTest(e, root);
      const top = stack[0] as Element | undefined;
      const id = top?.getAttribute(PE_ATTR) ?? null;
      setSelectedId(id);
      setOverlapMenu(null);
      // 仅当按下的是"已选中"元素才进入拖拽（选中与拖拽分离，避免误拖背景）
      if (id && top && id === selectedId) {
        dragState.current = {
          el: top,
          startX: e.clientX,
          startY: e.clientY,
          origTransform: top.getAttribute("transform"),
          moved: false,
        };
        try {
          (e.target as Element).setPointerCapture?.(e.pointerId);
        } catch {
          // jsdom/老内核无 capture 时拖拽仍可用（指针在画布内移动）
        }
      }
    },
    [selectedId],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const st = dragState.current;
    const root = rootRef.current;
    if (!st || !root) return;
    const { dx, dy } = screenToViewBox(
      root,
      e.clientX - st.startX,
      e.clientY - st.startY,
    );
    if (Math.abs(dx) + Math.abs(dy) < 0.5 && !st.moved) return;
    st.moved = true;
    applyTranslate(st.el, dx, dy, st.origTransform);
  }, [applyTranslate]);

  const onPointerUp = useCallback(() => {
    const st = dragState.current;
    dragState.current = null;
    if (st?.moved) commit();
  }, [commit]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      e.preventDefault();
      const stack = hitTest(e, root).map((el) => {
          const ctx = elementContext(el);
          return {
            id: ctx.peId,
            label: `${ctx.tag} · ${ctx.text || (ctx.bbox ? `${Math.round(ctx.bbox.w)}×${Math.round(ctx.bbox.h)}` : "")}`,
          };
        });
      if (stack.length > 0) setOverlapMenu(stack);
    },
    [],
  );

  // ---- 键盘：方向键微调（选中时），Esc 取消选中 ----
  const nudge = useCallback(
    (dx: number, dy: number) => {
      const el = selectedEl;
      if (!el) return;
      const orig = el.getAttribute("transform");
      // 以当前累计 translate 为基准继续微调；transform 余项（rotate 等）必须保留
      const m = orig?.match(/^translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)?/);
      const nx = (Number(m?.[1]) || 0) + dx;
      const ny = (Number(m?.[2]) || 0) + dy;
      const rest = m ? orig!.slice(m[0].length).trim() : orig ?? "";
      el.setAttribute(
        "transform",
        `translate(${Math.round(nx * 100) / 100} ${Math.round(ny * 100) / 100})${rest ? ` ${rest}` : ""}`,
      );
      setTick((v) => v + 1);
      // 连续微调 400ms 内合并为一次历史
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
      nudgeTimer.current = setTimeout(commit, 400);
    },
    [selectedEl, applyTranslate, commit],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selectedEl) return;
      const step = e.shiftKey ? 10 : 1;
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
      };
      if (map[e.key]) {
        e.preventDefault();
        nudge(map[e.key][0], map[e.key][1]);
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setOverlapMenu(null);
      }
    },
    [selectedEl, nudge],
  );

  // ---- mini-inspector 字段修改 ----
  const setAttr = useCallback(
    (name: string, value: string | null) => {
      const el = selectedEl;
      if (!el) return;
      if (value === null) el.removeAttribute(name);
      else el.setAttribute(name, value);
      setTick((v) => v + 1);
      commit();
    },
    [selectedEl, commit],
  );

  const setText = useCallback(
    (value: string) => {
      const el = selectedEl;
      if (!el || el.nodeName.toLowerCase() !== "text") return;
      el.textContent = value;
      setTick((v) => v + 1);
      commit();
    },
    [selectedEl, commit],
  );

  const ctx = selectedEl ? elementContext(selectedEl) : null;
  const fontSize =
    selectedEl?.getAttribute("font-size") ??
    selectedEl?.querySelector("tspan")?.getAttribute("font-size") ??
    "";
  const fill = selectedEl?.getAttribute("fill") ?? "";
  const textValue =
    selectedEl && selectedEl.nodeName.toLowerCase() === "text"
      ? (selectedEl.textContent ?? "")
      : "";

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        ref={hostRef}
        tabIndex={0}
        data-pe-canvas=""
        className="w-full select-none outline-none [&_svg]:h-auto [&_svg]:w-full [&_[data-pe-id]]:cursor-pointer [&_[data-pe-id]:hover]:outline [&_[data-pe-id]:hover]:outline-1 [&_[data-pe-id]:hover]:outline-accent/60 [&_[data-pe-id][data-selected]]:outline [&_[data-pe-id][data-selected]]:outline-2 [&_[data-pe-id][data-selected]]:outline-accent"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={onContextMenu}
        onKeyDown={onKeyDown}
      />

      {/* 重叠元素挑选菜单（右键） */}
      {overlapMenu && (
        <div className="absolute right-2 top-2 z-20 w-56 rounded-lg border border-border bg-bg-elevated p-1 shadow-lg">
          {overlapMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedId(item.id);
                setOverlapMenu(null);
              }}
              className="block w-full truncate rounded px-2 py-1 text-left text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => setOverlapMenu(null)}
            className="mt-0.5 block w-full rounded px-2 py-1 text-left text-xs text-text-muted hover:bg-bg-hover"
          >
            {t("common.cancel")}
          </button>
        </div>
      )}

      {/* mini-inspector（选中元素浮层） */}
      {ctx && (
        <div
          className="absolute right-2 top-2 z-10 w-60 space-y-2 rounded-lg border border-border bg-bg-elevated/95 p-2.5 shadow-lg backdrop-blur"
          data-pe-inspector=""
        >
          <div className="truncate text-[11px] font-medium text-text-muted">
            {ctx.tag} · {ctx.text || (ctx.bbox ? `${Math.round(ctx.bbox.w)}×${Math.round(ctx.bbox.h)}` : "")}
          </div>
          {textValue !== "" && (
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-text-muted">
                {t("preview.textContent")}
              </span>
              <input
                key={ctx.peId}
                defaultValue={textValue}
                onBlur={(e) => {
                  if (e.target.value !== textValue) setText(e.target.value);
                }}
                className="w-full rounded border border-border bg-bg-surface px-1.5 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
              />
            </label>
          )}
          {fontSize !== "" && (
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-text-muted">
                {t("preview.fontSize")}
              </span>
              <input
                type="number"
                defaultValue={Number(fontSize) || ""}
                onBlur={(e) =>
                  setAttr("font-size", e.target.value || null)
                }
                className="w-full rounded border border-border bg-bg-surface px-1.5 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
              />
            </label>
          )}
          {fill !== "" && (
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-text-muted">
                {t("preview.fill")}
              </span>
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(fill) ? fill : "#000000"}
                onChange={(e) => setAttr("fill", e.target.value)}
                className="h-7 w-full rounded border border-border bg-bg-surface"
              />
            </label>
          )}
          <p className="text-[10px] leading-relaxed text-text-muted">
            {t("preview.nudgeHint")}
          </p>
          {onAnnotate && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem(
                  "instruction",
                ) as HTMLInputElement | null;
                const value = input?.value.trim();
                if (value) {
                  onAnnotate(value, ctx);
                  input!.value = "";
                }
              }}
            >
              <input
                name="instruction"
                placeholder={t("preview.aiEditPlaceholder")}
                className="w-full rounded border border-border bg-bg-surface px-1.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                className="mt-1 w-full rounded bg-gradient-to-r from-ai to-orange-400 px-2 py-1 text-xs font-medium text-white hover:opacity-90"
              >
                {t("preview.aiEditSubmit")}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
