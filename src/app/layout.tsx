import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";
import { OfflineGuard } from "@/components/OfflineGuard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Void - Track your movies & TV",
  description: "Mobile-first movie and TV show watchlist tracker",
  manifest: "/void/manifest.json",
  icons: {
    icon: "/void/logo.png",
    apple: "/void/logo.png",
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
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-300`}>
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            forcedTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
          <AppProvider>
            <OfflineGuard>
              <main className="container mx-auto min-h-screen bg-white dark:bg-gray-950 pb-12 pt-4 px-2 sm:px-3 lg:px-4 transition-colors duration-300">
                {children}
              </main>
            </OfflineGuard>
            <Toaster position="bottom-center" theme="dark" closeButton />
          </AppProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/void/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}