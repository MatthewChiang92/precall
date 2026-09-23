import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old paths, renamed to match the page names; keeps shared links working.
  redirects() {
    return [
      { source: "/vibe", destination: "/fear-greed", permanent: false },
      { source: "/vibe/:symbol", destination: "/fear-greed/:symbol", permanent: false },
      { source: "/fly", destination: "/seed-to-ipo", permanent: false },
    ];
  },
};

export default nextConfig;
