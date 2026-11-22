import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zusammen CRM",
  description: "Kunder, pipeline og opgaver for Zusammen",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f4f46",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
