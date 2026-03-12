import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { Toaster } from "sonner";
import { OfflineGuard } from "@/components/OfflineGuard";
import { PWAUpdater } from "@/components/PWAUpdater";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Void - Track your movies & TV",
  description: "Mobile-first movie and TV show watchlist tracker",
  manifest: "/void/manifest.json",
  icons: {
    icon: "/void/icon.svg",
    apple: "/void/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Void",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#030712",
  viewportFit: "auto",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-brand-bg text-foreground min-h-screen transition-colors duration-300`}>
        <AppProvider>
          <OfflineGuard>
            <main className="w-full min-h-screen pb-12 px-0 transition-colors duration-300">
              {children}
            </main>
          </OfflineGuard>
          <Toaster position="bottom-center" theme="dark" closeButton />
          <PWAUpdater />
        </AppProvider>
      </body>
    </html>
  );
}