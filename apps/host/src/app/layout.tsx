import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Metriq host",
  description: "Task host, SSE feed, and indexer for Metriq.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "ui-monospace, monospace", padding: 24 }}>{children}</body>
    </html>
  );
}
