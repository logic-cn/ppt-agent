export interface AutoFixAction {
  type:
    "set_title" | "remove_empty_bullet" | "change_layout" | "append_closing";
  slideId?: string;
  description: string;
}
