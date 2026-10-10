import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Student Tracker",
    short_name: "Tracker",
    description: "A calm, mobile-first place for classes, tasks, and school dates.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f1eb",
    theme_color: "#f3f1eb",
    icons: [
      { src: "/icon-192.png?v=20261009", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png?v=20261009", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png?v=20261009",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
