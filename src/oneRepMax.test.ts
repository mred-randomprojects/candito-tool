import { describe, it, expect } from "vitest";
import { estimate1RM, estimateFromPrescription, format1RM } from "./oneRepMax";

// ---------------------------------------------------------------------------
// Test cases sourced from https://strengthlevel.com/one-rep-max-calculator
// ---------------------------------------------------------------------------

describe("estimate1RM", () => {
  describe("edge cases", () => {
    it("returns null for 0 reps", () => {
      expect(estimate1RM(100, 0)).toBeNull();
    });

    it("returns null for negative reps", () => {
      expect(estimate1RM(100, -1)).toBeNull();
    });

    it("returns the weight itself for 1 rep", () => {
      expect(estimate1RM(120, 1)).toBe(120);
    });
  });

  describe("Brzycki range (reps ≤ 10) — verified against strengthlevel.com", () => {
    it("120 kg × 4 reps → 130.9 kg", () => {
      const result = estimate1RM(120, 4);
      expect(result).not.toBeNull();
      expect(result!.toFixed(1)).toBe("130.9");
    });

    it("100 kg × 10 reps → 133.3 kg", () => {
      const result = estimate1RM(100, 10);
      expect(result).not.toBeNull();
      expect(result!.toFixed(1)).toBe("133.3");
    });
  });

  describe("Epley range (reps > 10) — verified against strengthlevel.com", () => {
    it("32 kg × 16 reps → 49.1 kg", () => {
      const result = estimate1RM(32, 16);
      expect(result).not.toBeNull();
      expect(result!.toFixed(1)).toBe("49.1");
    });

    it("50 kg × 33 reps → 105.0 kg", () => {
      const result = estimate1RM(50, 33);
      expect(result).not.toBeNull();
      expect(result!.toFixed(1)).toBe("105.0");
    });
  });

  describe("seamless transition at 10 reps", () => {
    it("Brzycki at 10 and Epley at 11 are close for same weight", () => {
      const at10 = estimate1RM(100, 10);
      const at11 = estimate1RM(100, 11);
      expect(at10).not.toBeNull();
      expect(at11).not.toBeNull();
      // Both should give reasonable, close values (no discontinuity)
      expect(Math.abs(at11! - at10!)).toBeLessThan(5);
    });
  });

  describe("no longer breaks at high reps", () => {
    it("handles 37 reps (previously broke with Brzycki)", () => {
      const result = estimate1RM(50, 37);
      expect(result).not.toBeNull();
      expect(result!).toBeGreaterThan(0);
    });

    it("handles 50 reps", () => {
      const result = estimate1RM(30, 50);
      expect(result).not.toBeNull();
      expect(result!).toBeGreaterThan(0);
    });
  });
});

describe("estimateFromPrescription", () => {
  it("returns null for null weight", () => {
    expect(estimateFromPrescription(null, "5")).toBeNull();
  });

  it("returns null for zero weight", () => {
    expect(estimateFromPrescription(0, "5")).toBeNull();
  });

  it("handles fixed rep count", () => {
    const result = estimateFromPrescription(120, "4");
    expect(result).not.toBeNull();
    expect(result!.low.toFixed(1)).toBe("130.9");
    expect(result!.high.toFixed(1)).toBe("130.9");
  });

  it("handles rep range", () => {
    const result = estimateFromPrescription(100, "8-12");
    expect(result).not.toBeNull();
    // More reps at same weight → higher estimated 1RM
    expect(result!.high).toBeGreaterThan(result!.low);
  });

  it("returns null for MR", () => {
    expect(estimateFromPrescription(100, "MR")).toBeNull();
  });
});

describe("format1RM", () => {
  it("formats a single value", () => {
    expect(format1RM({ low: 130.909, high: 130.909 }, "kg")).toBe(
      "130.9 kg",
    );
  });

  it("formats a range", () => {
    expect(format1RM({ low: 140.0, high: 120.0 }, "kg")).toBe(
      "140.0–120.0 kg",
    );
  });
});
