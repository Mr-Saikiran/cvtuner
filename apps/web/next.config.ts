import type { NextConfig } from "next";

/**
 * Served under techswitch.in/cvtuner. The main site proxies /cvtuner/* to this app
 * (see docs/DEPLOY.md), so every route and asset lives under the same base path.
 */
const config: NextConfig = {
  basePath: "/cvtuner",
  transpilePackages: ["@cvtuner/core", "@cvtuner/render"],
  serverExternalPackages: ["unpdf", "mammoth"],
  async redirects() {
    // the bare Vercel domain has nothing at "/", send visitors to the app
    return [{ source: "/", destination: "/cvtuner", basePath: false, permanent: false }];
  },
};

export default config;
