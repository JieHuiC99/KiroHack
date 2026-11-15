import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SunSafe",
  description: "Accessible campus evacuation guidance",
};

// Never block pinch-zoom: low-vision users rely on it.
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// System fonts on purpose: nothing to download, so the page still renders on a bad network.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
