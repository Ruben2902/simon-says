import { describe, expect, it } from "vitest";

import { SlidingWindowRateLimiter } from "./sliding-window-rate-limiter.js";

describe("SlidingWindowRateLimiter", () => {
  it("rejects attempts beyond the limit inside the window", () => {
    const limiter = new SlidingWindowRateLimiter();

    expect(limiter.consume("socket:input", 2, 1_000, 1_000)).toBe(true);
    expect(limiter.consume("socket:input", 2, 1_000, 1_100)).toBe(true);
    expect(limiter.consume("socket:input", 2, 1_000, 1_200)).toBe(false);
  });

  it("accepts attempts after the old window expires", () => {
    const limiter = new SlidingWindowRateLimiter();

    limiter.consume("socket:input", 1, 1_000, 1_000);
    expect(limiter.consume("socket:input", 1, 1_000, 2_001)).toBe(true);
  });
});
