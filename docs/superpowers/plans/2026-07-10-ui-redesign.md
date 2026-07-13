# PPT Agent UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all UI components with new warm white color system, gradient accents (indigo→violet for primary, coral orange for AI), and refined typography/layout.

**Architecture:** Pure CSS/styling overhaul. No data flow, state management, or feature changes. Update Tailwind config tokens → global CSS → page-level components → individual UI components. Every component keeps its existing structure and logic — only class names and style values change.

**Tech Stack:** Tailwind CSS 3.4, React 18, TypeScript, Lucide icons

## Global Constraints

- All colors come from design tokens in `tailwind.config.ts` — no hardcoded hex values in JSX
- AI-specific buttons use `--color-ai` (coral orange `#FF6B6B → #FFA94D`) — never the general accent gradient
- General primary buttons use `--color-accent` (indigo→violet `#4F6FFF → #8B5CF6`)
- Danger buttons use `--color-error` (#EF4444) — no other red variant
- Border radius tokens: `rounded-lg` = 8px (input/card default), `rounded-xl` = 12px (dialog/card emphasis)
- No new dependencies, no new components, no file structure changes
- Inter font loaded via Google Fonts (already in `index.html`)

---

### Task 1: Design Tokens — Tailwind Config + Global CSS

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: The spec's color palette, type scale, spacing, and br values
- Produces: CSS custom properties and Tailwind utility classes consumed by all subsequent tasks

- [ ] **Step 1: Update Tailwind config colors**

Replace the current dark-theme color palette with the new light-theme palette:

```typescript
// tailwind.config.ts — extend.colors block
colors: {
  'bg-page': '#FAF9F6',
  'bg-surface': '#F5F4F0',
  'bg-elevated': '#FFFFFF',
  'bg-hover': '#EEEDE8',
  'border': '#E8E7E2',
  'border-strong': '#D4D3CE',
  'text-primary': '#1A1A1E',
  'text-secondary': '#6B6B76',
  'text-muted': '#9A9AA8',
  'accent': '#4F6FFF',
  'accent-hover': '#3B5FFF',
  'accent-soft': '#EEF0FF',
  'ai': '#FF6B6B',
  'ai-hover': '#FF5252',
  'ai-soft': '#FFF5F5',
  'success': '#22C55E',
  'warning': '#F59E0B',
  'error': '#EF4444',
}
```

- [ ] **Step 2: Update border radius**

```typescript
// tailwind.config.ts
borderRadius: {
  DEFAULT: '8px',
  lg: '10px',
  xl: '12px',
  '2xl': '14px',
}
```

- [ ] **Step 3: Convert to CSS variables (optional, for runtime theme)**

Add a `:root` block to `tailwind.config.ts` using `@theme` or keep as Tailwind utilities. Since this app doesn't do runtime theme switching, plain Tailwind classes suffice.

- [ ] **Step 4: Update global styles**

```css
/* src/styles.css — update the existing file */
html, body, #root {
  height: 100%;
  overflow: hidden;
  background-color: #FAF9F6;
  color: #1A1A1E;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  user-select: none;
}

/* Custom scrollbar — keep structure, update colors */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #D4D3CE;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #B8B7B2;
}
```

- [ ] **Step 5: Verify**

Run: `pnpm run dev` — check that the app loads with warm white background

- [ ] **Step 6: Commit**

No commit unless user requests.

---

### Task 2: Home Page

**Files:**
- Modify: `src/pages/Home.tsx`

**Interfaces:**
- Consumes: Design tokens from Task 1
- Produces: n/a (leaf task)

- [ ] **Step 1: Update header**

Replace current header with light version:
- Background: `bg-white border-b border-border`
- Logo: gradient background `bg-gradient-to-r from-accent to-purple-500`
- Settings icon: `text-text-secondary hover:text-text-primary`

- [ ] **Step 2: Update action cards**

Replace the three "开始制作" cards:
- Background: `bg-white border-border hover:border-accent`
- Icon circle: `bg-accent-soft text-accent`
- Transition: `hover:shadow-sm`
- Keep all existing icon/components (`Plus`, `FileText`, `LayoutTemplate`)

- [ ] **Step 3: Update recent projects grid**

Replace recent project items:
- Card: `bg-white border-border rounded-xl p-5 hover:border-accent hover:shadow-sm`
- Page count badge: `bg-bg-surface text-text-muted`
- Delete button: hover red (`hover:bg-error/10 hover:text-error`)
- Empty state "快速开始" section: `bg-bg-surface border-border`

- [ ] **Step 4: Verify**

Run: `pnpm run dev` — navigate to `/`, verify all sections render correctly

---

### Task 3: Editor Toolbar

**Files:**
- Modify: `src/pages/Editor.tsx`

**Interfaces:**
- Consumes: Design tokens
- Produces: n/a

- [ ] **Step 1: Restyle toolbar container**

Replace `<header className="flex items-center justify-between border-b border-border bg-bg-surface px-4 py-2">` with:
```
<header className="flex items-center justify-between border-b border-border bg-white px-4 h-10">
```

- [ ] **Step 2: Update all toolbar buttons**

Replace each toolbar button's className — applying new color tokens:
- Back button: `text-text-secondary hover:bg-bg-hover hover:text-text-primary`
- Title button: `text-text-primary hover:bg-bg-hover rounded px-1.5 py-0.5 text-sm font-medium`
- Page count: `text-text-muted text-xs`
- Panel toggles (PanelLeft/PanelRight): active = `text-accent`, inactive = `text-text-secondary`, both `hover:bg-bg-hover`
- Delete (Trash2): `text-text-secondary hover:bg-error/10 hover:text-error`
- Theme button (Palette + "主题"): `text-text-secondary hover:bg-bg-hover`
- Import (Upload): `text-text-secondary hover:bg-bg-hover`
- Present (Monitor): `text-text-secondary hover:bg-bg-hover`
- Export (Download): `bg-gradient-to-r from-accent to-purple-500 text-white hover:opacity-90`

- [ ] **Step 3: Update theme dropdown**

Replace theme dropdown container:
```
className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-border bg-white p-1 shadow-lg"
```
Keep all existing logic and items. Just change the styling.

- [ ] **Step 4: Update task panel**

Task panel at top of editor (job status):
```
className="border-b border-border bg-bg-surface px-4 py-2"
```

- [ ] **Step 5: Verify**

Run: `pnpm run dev` — open editor, verify toolbar renders with all 10 items, theme dropdown works

---

### Task 4: Editor Three-Column Layout

**Files:**
- Modify: `src/pages/Editor.tsx` (layout wrappers)

**Interfaces:**
- Consumes: Design tokens
- Produces: n/a

- [ ] **Step 1: Update main container**

```
className="flex flex-1 overflow-hidden"
```

- [ ] **Step 2: Update left sidebar**

Current: `<aside className="flex w-80 flex-col border-r border-border bg-bg-surface">`
New: `<aside className="flex w-[280px] flex-col border-r border-border bg-white">`
(Also update the PanelLeft toggle button to reflect collapsed state)

- [ ] **Step 3: Update center preview area**

The main preview container is inside `<main>`. Update its wrapper:
```
<main className="flex flex-1 flex-col overflow-hidden bg-bg-surface">
```

- [ ] **Step 4: Update right sidebar**

Current: `<aside className="flex w-80 flex-col border-l border-border bg-bg-surface">`
New: `<aside className="flex w-[280px] flex-col border-l border-border bg-white">`

- [ ] **Step 5: Update collapsed state styling**

When `leftOpen` is false, show a narrow icon bar (36px) with the toggle button:
```
<aside className="flex w-9 flex-col items-center border-r border-border bg-white py-2">
  <button className="w-6 h-6 rounded-md bg-accent-soft text-accent flex items-center justify-center">
    <PanelLeft className="h-3.5 w-3.5" />
  </button>
</aside>
```
Same for right panel collapse.

- [ ] **Step 6: Verify**

Run: `pnpm run dev` — toggle left/right panels, verify collapse/expand works, preview area fills remaining space

---

### Task 5: Outline Panel

**Files:**
- Modify: `src/components/outline/outline-editor.tsx`
- Modify: `src/components/outline/sortable-slide-item.tsx`

- [ ] **Step 1: Restyle outline-editor.tsx**

Replace classes:
- Container: `flex h-full flex-col bg-white`
- Header "大纲": `flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted`
- Add page button (Plus): `rounded p-1 hover:bg-bg-hover text-text-secondary`
- Empty state: `rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-text-muted`

- [ ] **Step 2: Restyle sortable-slide-item.tsx**

Replace classes for each slide item:
- Selected: `bg-bg-surface rounded-lg border border-accent border-l-[3px] border-l-accent`
- Default: `bg-white rounded-lg border border-border hover:bg-bg-hover`
- Quality severity indicator: green dot (success) for error, yellow (warning) for warning, red (error) for error

- [ ] **Step 3: Verify**

Run: `pnpm run dev` — verify outline panel renders with correct spacing, selected state, drag handle

---

### Task 6: Inspector Panel + All Tabs

**Files:**
- Modify: `src/components/inspector/inspector-panel.tsx`
- Modify: `src/components/inspector/slide-tab.tsx`
- Modify: `src/components/inspector/chart-tab.tsx`
- Modify: `src/components/inspector/image-tab.tsx`
- Modify: `src/components/inspector/notes-tab.tsx`

- [ ] **Step 1: Verify tab order is correct**

In `inspector-panel.tsx`, confirm tabs array is:
```typescript
const tabs: { key: Tab; label: string }[] = [
  { key: "ai", label: "AI" },
  { key: "slide", label: "页面" },
  { key: "chart", label: "图表" },
  { key: "image", label: "配图" },
  { key: "notes", label: "备注" },
];
```
No change needed — already correct.

- [ ] **Step 2: Restyle tab bar**

Replace tab bar classes:
```
className="flex border-b border-border"
```
Each tab button:
- Active: `flex-1 px-2 py-2.5 text-xs font-semibold text-accent border-b-2 border-accent`
- Inactive: `flex-1 px-2 py-2.5 text-xs text-text-muted hover:text-text-secondary`

- [ ] **Step 3: Restyle slide-tab.tsx**

Update input fields, selects, buttons with new token classes:
- Labels: `text-xs text-text-muted mb-1`
- Inputs: `w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10`
- AI buttons: use `bg-gradient-to-r from-ai to-orange-400 text-white` (coral orange)

- [ ] **Step 4: Restyle chart-tab.tsx**

Same input/button pattern as slide-tab.

- [ ] **Step 5: Restyle image-tab.tsx**

Confirm it renders (was omitted in v2 mockup):
- Image source select, URL input, alt text input, position select
- AI generate button: coral orange gradient
- Delete button: `border border-error/20 text-error hover:bg-error/5`
- Empty state: `text-center text-sm text-text-muted` with dashed border AI button

- [ ] **Step 6: Restyle notes-tab.tsx**

- Textarea: same styling as inputs
- Container: `text-sm space-y-2`

- [ ] **Step 7: Verify**

Run: `pnpm run dev` — click through all 5 tabs, verify each renders correctly

---

### Task 7: AI Chat Panel — Coral Orange Buttons

**Files:**
- Modify: `src/components/chat/chat-panel.tsx`

- [ ] **Step 1: Update AI send button**

Replace the send button in the chat input area:
```
className="rounded-lg bg-gradient-to-r from-ai to-orange-400 p-2 text-white hover:opacity-90 disabled:opacity-40 shadow-sm shadow-ai/20"
```

- [ ] **Step 2: Update "Apply modifications" button**

```
className="rounded-md bg-gradient-to-r from-ai to-orange-400 px-3 py-1 text-xs font-medium text-white hover:opacity-90"
```

- [ ] **Step 3: Update template generation button**

```
className="flex w-full items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-ai to-orange-400 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
```

- [ ] **Step 4: Update message styling**

- User messages: `bg-accent-soft/30 text-text-primary rounded-lg px-3 py-2.5`
- Assistant messages: `bg-bg-surface text-text-secondary rounded-lg px-3 py-2.5`

- [ ] **Step 5: Update input area**

```
className="rounded-xl border border-border bg-white px-3 py-2 flex items-center gap-2"
```
Input field inside:
```
className="max-h-32 flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
```

- [ ] **Step 6: Update template selector panel**

```
className="border-b border-border bg-bg-surface px-3 py-3"
```

- [ ] **Step 7: Verify**

Run: `pnpm run dev` — open AI chat tab, verify coral orange buttons, message styling, input area

---

### Task 8: Dialogs — Import / Template / Confirm / Theme Editor

**Files:**
- Modify: `src/components/import-dialog.tsx`
- Modify: `src/components/template-dialog.tsx`
- Modify: `src/components/confirm-dialog.tsx`
- Modify: `src/components/theme-editor-dialog.tsx`

- [ ] **Step 1: Restyle import-dialog.tsx**

- Overlay: `fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center`
- Dialog card: `bg-white rounded-2xl shadow-xl w-full max-w-lg p-6`

- [ ] **Step 2: Restyle template-dialog.tsx**

Same overlay/dialog card pattern. Update template buttons:
- Selected: `border-accent bg-accent-soft/20`
- Default: `border-border bg-white hover:border-accent`

- [ ] **Step 3: Restyle confirm-dialog.tsx**

- Overlay + card: same pattern
- Cancel button: `rounded-lg border border-border px-4 py-2 text-sm text-text-primary bg-white hover:bg-bg-hover`
- Confirm button (danger): `rounded-lg bg-error px-4 py-2 text-sm text-white hover:bg-error/90`
- Confirm button (normal): `rounded-lg bg-gradient-to-r from-accent to-purple-500 px-4 py-2 text-sm text-white`

- [ ] **Step 4: Restyle theme-editor-dialog.tsx**

Same overlay/dialog card pattern. Update:
- Color picker swatches: `w-8 h-8 rounded-lg border-2`
- Input fields: same as slide-tab inputs
- Save button: accent gradient
- Close button: `text-text-muted hover:text-text-primary`

- [ ] **Step 5: Verify**

Run: `pnpm run dev` — trigger each dialog, verify overlay, card, and button styling

---

### Task 9: Presentation Mode + Quality Report + Toast

**Files:**
- Modify: `src/components/presentation-mode.tsx`
- Modify: `src/components/quality-report.tsx`
- Modify: `src/components/ui/toast-container.tsx`

- [ ] **Step 1: Restyle presentation-mode.tsx**

- Container: `fixed inset-0 z-50 bg-black flex flex-col`
- Top bar (minimal): `bg-white/5 backdrop-blur-sm text-white/60 px-4 py-2`
- Bottom bar (auto-hide): same as top bar
- Notes panel: `bg-white/10 backdrop-blur-md text-white rounded-xl p-4`

- [ ] **Step 2: Restyle quality-report.tsx**

- Card: `bg-white border border-border rounded-xl p-4 shadow-sm`
- Score: `text-lg font-semibold text-accent`
- Error items: `text-error` with red dot
- Warning items: `text-warning` with yellow dot
- Info items: `text-text-secondary` with blue dot
- Fix button: `rounded-md bg-gradient-to-r from-ai to-orange-400 px-3 py-1 text-xs text-white`

- [ ] **Step 3: Restyle toast-container.tsx**

- Toast card: `bg-white border border-border rounded-xl px-4 py-3 shadow-lg flex items-center gap-3`
- Success icon: `w-5 h-5 rounded-full bg-success text-white flex items-center justify-center text-xs`
- Error icon: `w-5 h-5 rounded-full bg-error text-white flex items-center justify-center text-xs`
- Close button: `text-text-muted hover:text-text-primary`

- [ ] **Step 4: Verify**

Run: `pnpm run dev` — trigger a toast, open presentation mode, check quality report

---

### Task 10: Settings Page

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Update page container**

```
<div className="flex h-full flex-col bg-bg-page">
<header className="flex items-center justify-between border-b border-border bg-white px-6 py-3">
```

- [ ] **Step 2: Update settings form sections**

- Section card: `bg-white border border-border rounded-xl p-6`
- Section title: `text-base font-semibold text-text-primary mb-4`

- [ ] **Step 3: Update form elements**

Same input/select/button patterns as Tasks 6-7.

- [ ] **Step 4: Verify**

Run: `pnpm run dev` — navigate to `/settings`, verify all sections render correctly

---

## Self-Review Checklist

- [ ] All 10 tasks cover every section of the design spec (colors, layout, components, etc.)
- [ ] No placeholder steps — every step has concrete code/classes
- [ ] No references to undefined tokens or components
- [ ] Tasks are independent and testable in sequence
- [ ] Every existing feature is preserved (verified against `src/` structure)
