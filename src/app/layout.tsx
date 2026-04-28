import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { Toaster } from "sonner";
import { OfflineGuard } from "@/components/OfflineGuard";

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
      <body className={`${inter.className} bg-brand-bg text-foreground min-h-screen flex flex-col transition-colors duration-300`}>
        <AppProvider>
          <OfflineGuard>
            <main className="w-full min-h-screen flex-1 transition-colors duration-300">
              {children}
            </main>
            <footer className="w-full py-4 text-center text-xs text-brand-silver/50">
              Data provided by TMDB.
            </footer>
          </OfflineGuard>
          <Toaster position="bottom-center" theme="dark" closeButton />
        </AppProvider>
      </body>
    </html>
  );
}
