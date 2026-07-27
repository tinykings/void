import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { Toaster } from "sonner";
import { OfflineGuard } from "@/components/OfflineGuard";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { MotionPreferences } from "@/components/MotionPreferences";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const utility = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-utility",
});
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tinykings.github.io/void";
const normalizeBasePath = (path?: string) => {
  const trimmedPath = (path || "").trim().replace(/^\/+|\/+$/g, "");
  return trimmedPath ? `/${trimmedPath}` : "";
};
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
const withBasePath = (path: string) => `${basePath}${path}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Void - Track your movies, shows, and games",
  description: "Mobile-first media playlist and history tracker",
  manifest: withBasePath("/manifest.json"),
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [
      { url: withBasePath("/favicon.png"), sizes: "64x64", type: "image/png" },
      { url: withBasePath("/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: withBasePath("/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: withBasePath("/apple-touch-icon.png"),
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Void",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#030712",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${utility.variable} bg-brand-bg text-foreground min-h-screen flex flex-col transition-colors duration-300`}>
        <MotionPreferences>
          <AppProvider>
            <KeyboardShortcuts />
            <OfflineGuard>
              <main className="w-full min-h-screen flex-1 transition-colors duration-300">
                {children}
              </main>
            </OfflineGuard>
            <Toaster
              position="bottom-center"
              theme="dark"
              closeButton
              offset={{ bottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
              mobileOffset={{ bottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
            />
          </AppProvider>
        </MotionPreferences>
      </body>
    </html>
  );
}
