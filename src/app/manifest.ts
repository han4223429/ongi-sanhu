import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE, THEME } from "@/lib/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    lang: "ko",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: THEME.bg,
    theme_color: THEME.bg,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
