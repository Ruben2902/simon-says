import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("supports a strict comma-separated origin allowlist", () => {
    const config = loadConfig({
      WEB_ORIGINS: "https://one.example, https://two.example",
      PORT: "4100",
      TRUST_PROXY: "true",
    });

    expect(config.webOrigins).toEqual([
      "https://one.example",
      "https://two.example",
    ]);
    expect(config.port).toBe(4_100);
    expect(config.trustProxy).toBe(true);
  });

  it("keeps compatibility with the previous WEB_ORIGIN variable", () => {
    const config = loadConfig({ WEB_ORIGIN: "http://localhost:4321" });
    expect(config.webOrigins).toEqual(["http://localhost:4321"]);
  });
});
