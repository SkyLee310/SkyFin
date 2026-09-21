import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. iOS opens the Home Screen app standalone from display, and
// takes its icon from the apple-touch-icon link in layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkyFin",
    short_name: "SkyFin",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
