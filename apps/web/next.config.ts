import type { NextConfig } from "next";
import path from "node:path";

const allowedDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins:
    allowedDevOrigins.length > 0 ? allowedDevOrigins : undefined,
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  poweredByHeader: false,
  transpilePackages: ["@simon/game-engine", "@simon/shared-types"],
};

export default nextConfig;
