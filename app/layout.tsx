import type { Metadata } from "next";
import "./globals.css";
import "@/features/notes/editor/notes-editor.css";
import "@/features/notes/editor/email-html.css";
import "@/components/file-preview.css";
import "@/components/excel-preview.css";
import { Toaster } from "sonner";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} dark`}>
      <body className="min-h-screen bg-[#0a0a0f] text-[#f4f4f5] antialiased">
        {/* Root ErrorBoundary: catches render-time crashes anywhere with graceful neon-themed fallback.
            No data loss (local + Supabase persistence). Strengthens overall app quality & resilience. */}
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster
          position="bottom-right"
          theme="dark"
          closeButton={false}
          richColors={false}
          duration={4000}
          className="bat-sonner-toaster"
          toastOptions={{
            classNames: {
              toast: "bat-toast",
              title: "bat-toast__title",
              description: "bat-toast__description",
              success: "bat-toast--success",
              error: "bat-toast--error",
              actionButton: "bat-toast__action",
            },
          }}
        />
      </body>
    </html>
  );
}
