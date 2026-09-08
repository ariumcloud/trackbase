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
      { url: "/Logo Roxa 42x42 PNG favicon.png", sizes: "42x42", type: "image/png" },
      { url: "/trackbase-icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/trackbase-icon-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/trackbase-apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/Logo Roxa 42x42 PNG favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/trackbase-apple-touch-icon-v2.png" sizes="180x180" />
        <link rel="manifest" href="/manifest.json?v=2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Trackbase" />
      </head>
      <body>{children}</body>
    </html>
  );
}
