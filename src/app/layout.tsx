import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "@serwist/turbopack/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkyFin",
  description: "Log RM spending from one chat line or one receipt photo.",
  // Add to Home Screen suggests this name rather than the page title ("Sign in · SkyFin").
  appleWebApp: { title: "SkyFin" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  // The page runs under the home indicator, so bars pinned to the bottom add pb-safe.
  viewportFit: "cover",
  // Matches --background in each system theme, so the status bar blends into the page.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#01020a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        {/* The service worker (offline page, push) runs in production builds only. */}
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV !== "production"}>
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
