import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.wgsl": {
        loaders: ["ts-shader-loader"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
