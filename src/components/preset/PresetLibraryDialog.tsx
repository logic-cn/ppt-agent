import { PresetPickerDialog } from "./PresetPickerDialog";
import type { DeckPreset } from "@/types/preset";
import type { Slide } from "@/types/deck";

interface Props {
  open: boolean;
  onClose: () => void;
  onGenerate: (params: {
    preset: DeckPreset;
    topic: string;
    slides: Slide[];
  }) => void | Promise<void>;
}

export function PresetLibraryDialog({ open, onClose, onGenerate }: Props) {
  return (
    <PresetPickerDialog open={open} onClose={onClose} onGenerate={onGenerate} />
  );
}
