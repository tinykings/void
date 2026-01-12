import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Couch - Track your movies & TV",
  description: "Mobile-first movie and TV show watchlist tracker",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen pb-20 transition-colors duration-300`}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
          <AppProvider>
            <main className="container mx-auto min-h-screen bg-white dark:bg-gray-950 pb-24 pt-4 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
              {children}
            </main>
            <BottomNav />
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}