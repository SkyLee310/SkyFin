import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkyFin",
  description: "Log RM spending from one chat line or one receipt photo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
