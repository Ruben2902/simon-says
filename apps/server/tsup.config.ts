import { defineConfig } from "tsup";

export default defineConfig({
  bundle: true,
  clean: true,
  dts: false,
  entry: ["src/index.ts"],
  format: ["esm"],
  noExternal: [/^@simon\//],
  platform: "node",
  sourcemap: true,
  splitting: false,
  target: "node22",
});
