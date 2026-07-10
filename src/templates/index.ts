import type { Template } from "@/types/template";
import { quarterlyReview } from "./quarterly-review";
import { productLaunch } from "./product-launch";
import { marketAnalysis } from "./market-analysis";
import { businessPlan } from "./business-plan";
import { trainingMaterial } from "./training-material";

export const BUILTIN_TEMPLATES: Template[] = [
  quarterlyReview,
  productLaunch,
  marketAnalysis,
  businessPlan,
  trainingMaterial,
];

export { type Template } from "@/types/template";
