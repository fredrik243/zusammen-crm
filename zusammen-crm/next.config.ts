import type { NextConfig } from "next";

// Appen er et lille internt værktøj, hvor alle sider er bag login og altid
// skal vise friske data. Derfor bruges den klassiske, dynamiske rendering
// (uden Cache Components).
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
