import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Trackbase · O rastreamento profissional para quem quer lucro real",
  description:
    "Junte anúncios da Meta Ads, páginas, checkouts e vendas em uma operação clara, rápida e lucrativa com a Trackbase.",
  icons: {
    icon: [
      { url: "/Logo Roxa SVG - 1024x1024.svg", type: "image/svg+xml" },
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/logo.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/Logo Roxa SVG - 1024x1024.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Trackbase" />
      </head>
      <body>{children}</body>
    </html>
  );
}
