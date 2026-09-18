import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Scheduling feature was removed — send old links to the dashboard
      {
        source: "/scheduling",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
