import type { Metadata, Viewport } from "next";
import AppShell from "@/components/AppShell";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { INITIAL_THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Student Tracker",
  description: "A calm, mobile-first place for classes, tasks, and school dates.",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Tracker",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#216b52",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INITIAL_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ServiceWorkerRegistration />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
