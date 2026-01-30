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
    statusBarStyle: "default",
    title: "Void",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#030712",
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
            <main className="container mx-auto min-h-screen bg-brand-bg pb-12 pt-4 px-2 sm:px-3 lg:px-4 transition-colors duration-300">
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