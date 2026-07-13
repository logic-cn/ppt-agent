import type { Slide } from "./deck";
import type { DesignLock } from "./design";

export interface GalleryExample {
  id: string;
  name: string;
  thumbnail?: string;
  design: DesignLock;
  slides: Slide[];
}
