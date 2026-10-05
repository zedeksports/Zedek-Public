export default function manifest() {
  return {
    name: "ZEDEK SPORTS",
    short_name: "ZEDEK SPORTS",
    description: "Live football. Local teams. Real scores. Real people.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#071018",
    theme_color: "#071018",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
      { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
    ]
  };
}
