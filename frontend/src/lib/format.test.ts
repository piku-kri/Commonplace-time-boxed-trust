import { describe, it, expect } from "vitest";
import {
  stroopsToXlm,
  xlmToStroops,
  formatAddress,
  formatRelativeTime,
  formatDuration,
} from "./format";

describe("stroopsToXlm", () => {
  it("converts whole stroop amounts to XLM", () => {
    expect(stroopsToXlm("50000000")).toBe("5");
  });
  it("converts fractional stroop amounts to XLM", () => {
    expect(stroopsToXlm("12345678")).toBe("1.2345678");
  });
  it("trims trailing zeros", () => {
    expect(stroopsToXlm("15000000")).toBe("1.5");
  });
  it("handles zero", () => {
    expect(stroopsToXlm("0")).toBe("0");
  });
});

describe("xlmToStroops", () => {
  it("converts whole XLM to stroops", () => {
    expect(xlmToStroops("5")).toBe(50_000_000n);
  });
  it("converts fractional XLM to stroops", () => {
    expect(xlmToStroops("1.5")).toBe(15_000_000n);
  });
  it("round-trips with stroopsToXlm", () => {
    const original = "2500000";
    expect(xlmToStroops(stroopsToXlm(original)).toString()).toBe(original);
  });
});

describe("formatAddress", () => {
  it("truncates long addresses", () => {
    const addr = "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGH";
    expect(formatAddress(addr)).toBe(`${addr.slice(0, 4)}…${addr.slice(-4)}`);
  });
  it("leaves short strings unchanged", () => {
    expect(formatAddress("abc")).toBe("abc");
  });
});

describe("formatRelativeTime", () => {
  it("returns 'just now' for very recent timestamps", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatRelativeTime(now)).toBe("just now");
  });
  it("returns minutes for timestamps a few minutes old", () => {
    const fiveMinAgo = Math.floor(Date.now() / 1000) - 300;
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });
});

describe("formatDuration", () => {
  it("formats sub-hour durations in minutes", () => {
    expect(formatDuration(1800)).toBe("30 min");
  });
  it("formats sub-day durations in hours", () => {
    expect(formatDuration(7200)).toBe("2 hr");
  });
  it("formats multi-day durations in days", () => {
    expect(formatDuration(172800)).toBe("2 days");
  });
});
