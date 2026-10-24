import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true });
import type { NextConfig } from "next";
const upstream = process.env.API_URL;
if (
  process.env.VERCEL &&
  (!upstream ||
    !upstream.startsWith("https://") ||
    new URL(upstream).origin !== upstream)
)
  throw new Error(
    "Set API_URL to the reviewed HTTPS API origin before a Vercel build.",
  );
const config: NextConfig = {
  transpilePackages: ["@revynora/validation", "@revynora/ui"],
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination:
          (process.env.API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "") +
          "/api/v1/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'",
          },
        ],
      },
    ];
  },
};
export default config;
