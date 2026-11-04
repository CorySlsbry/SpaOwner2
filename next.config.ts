import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone tracing must root at the app dir — stray lockfiles up-tree
  // otherwise nest server.js under an absolute path and break Docker COPY.
  outputFileTracingRoot: process.cwd(),
  // Node-runtime SDKs stay external to the server bundle.
  serverExternalPackages: [
    "firebase-admin",
    "@anthropic-ai/sdk",
    "google-auth-library",
  ],
};

export default nextConfig;
