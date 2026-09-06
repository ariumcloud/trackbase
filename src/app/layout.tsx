import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "UTMLiso · Clareza para sua operação",
  description: "Rastreamento profissional para quem ainda está liso.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
