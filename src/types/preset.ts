import type { Slide } from "@/types/deck";
import type { DesignLock } from "@/types/design";

export interface DeckPreset {
  id: string;
  name: string;
  description?: string;
  design: DesignLock;
  slides: Slide[];
  qualityRules?: string[];
}
