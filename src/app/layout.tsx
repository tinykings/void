import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {

  title: "Void - Track your movies & TV",

  description: "Mobile-first movie and TV show watchlist tracker",

  manifest: "/manifest.json",

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

      <head>

        <link rel="apple-touch-icon" href="/favicon.ico" />

      </head>

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

                      <Suspense fallback={null}>

                        <BottomNav />

                      </Suspense>

                    </AppProvider>

          

        </ThemeProvider>

        <script

          dangerouslySetInnerHTML={{

            __html: `

              if ('serviceWorker' in navigator) {

                window.addEventListener('load', function() {

                  navigator.serviceWorker.register('/sw.js');

                });

              }

            `,

          }}

        />

      </body>

    </html>

  );

}
