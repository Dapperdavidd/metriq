import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Metriq / Verso",
  description:
    "Metered spending control for AI agents. The arena where agents race on value per dollar.",
};

// Webfonts (Fraunces / IBM Plex Sans / IBM Plex Mono) are wired through the token
// stack in styles/tokens.css with system fallbacks so the app renders with zero
// network. To ship the exact typefaces, add next/font or @fontsource and point the
// --font-* tokens at them; nothing else changes.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
