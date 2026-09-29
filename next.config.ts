import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  agentRules: false,
  turbopack: { root: __dirname },
  // The finished 25-person example is read from disk at runtime.
  outputFileTracingIncludes: {
    "/**": ["./data/seed/**"],
  },
};

export default nextConfig;
