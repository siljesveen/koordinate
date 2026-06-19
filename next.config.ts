import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/skjerm",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://*.infoskjermen.no https://app.infoskjermen.no https://infoskjermen.no",
          },
        ],
      },
    ];
  },
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
