/**
 * The document. Fonts, colours, and the manifest that makes this installable —
 * everything that is true of every screen, signed in or not.
 *
 * Both faces come through `next/font`, which downloads them at build time and
 * serves them from this origin. The artboards link Google's stylesheet instead;
 * that is right for a mockup and wrong for the app — a phone in a barangay hall
 * with no signal would render the whole roster in a fallback face, and the
 * request itself tells Google who is using the app and when.
 */
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";

import { ServiceWorker } from "@/components/ServiceWorker";

import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-bricolage",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bible Study Tayo",
  description: "Every attendee, every session.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Bible Study Tayo",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  // The tab bar sits on the home-indicator edge, so the app has to own the
  // whole screen; `viewportFit: cover` is what lets `env(safe-area-inset-*)`
  // report anything but zero.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d4e89",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
