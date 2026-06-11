import type { Metadata } from "next";
import "./globals.css";
import "./dark-theme.css";
import "./light-theme.css";
import "@/features/notes/editor/notes-editor.css";
import "@/features/notes/editor/email-html.css";
import "@/components/file-preview.css";
import "@/components/excel-preview.css";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeScript } from "@/components/ThemeScript";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppToaster } from "@/components/AppToaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Badazz Tasks — Get shit done. Beautifully.",
  description: "The most powerful, delightful, and addictive notes + task management app on the planet. Built for people who ship.",
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Badazz Tasks",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f12" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} dark`} data-theme="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-bg text-text-primary antialiased">
        <ErrorBoundary>
          <ThemeProvider>{children}</ThemeProvider>
        </ErrorBoundary>
        <AppToaster />
      </body>
    </html>
  );
}