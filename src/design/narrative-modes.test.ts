import { describe, it, expect } from "vitest";
import { selectModeByScenario, getMode } from "./narrative-modes";

describe("narrative-modes", () => {
  it("selectModeByScenario business_review -> pyramid", () => {
    expect(selectModeByScenario("business_review")).toBe("pyramid");
  });

  it("selectModeByScenario training -> instructional", () => {
    expect(selectModeByScenario("training")).toBe("instructional");
  });

  it("getMode pyramid titleRule 含 结论句", () => {
    expect(getMode("pyramid").titleRule).toContain("结论句");
  });
});
