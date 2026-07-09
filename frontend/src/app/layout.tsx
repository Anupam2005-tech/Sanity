import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import React from "react";
import { ToastProvider } from "./components/ToastProvider";
import { ThemeToggle } from "./components/ThemeToggle";

const geist = localFont({
  src: "../../public/fonts/GeistVF.woff",
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sanity CSV Importer",
  description: "AI-powered CRM lead importer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('theme');
                if (!theme) {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            })();
          `
        }} />
      </head>
      <body className={`${geist.variable} min-h-screen flex flex-col bg-background`}>
        <ToastProvider />
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between">
            <div className="font-bold text-xl tracking-tight text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-md w-8 h-8 flex items-center justify-center">SC</span>
              Sanity CRM
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center p-4 md:p-8">
          <div className="w-full max-w-5xl flex-1 flex flex-col">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
