import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/biler/kalender", destination: "/verksted", permanent: false },
      { source: "/biler/utilgjengelig", destination: "/verksted?tab=biler", permanent: false },
      { source: "/kjoretoy-utilgjengelig", destination: "/verksted", permanent: false },
      { source: "/henger/utilgjengelig", destination: "/verksted?tab=hengere", permanent: false },
    ];
  },
};

export default nextConfig;
