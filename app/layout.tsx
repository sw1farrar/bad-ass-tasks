import type { Metadata } from "next";
import "./globals.css";
import "@/features/notes/editor/notes-editor.css";
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
          closeButton={false}
          richColors={false}
          duration={1200}
          className="sonner-toast"
          style={{
            "--normal-bg": "rgba(17,17,20,0.92)",
            "--normal-border": "rgba(255,255,255,0.06)",
            "--normal-text": "#f4f4f5",
            "--success-bg": "rgba(17,17,20,0.92)",
            "--error-bg": "rgba(17,17,20,0.92)",
          } as React.CSSProperties}
          toastOptions={{
            classNames: {
              toast: "glass border border-white/10 shadow-xl backdrop-blur-xl",
              title: "text-sm font-medium",
              description: "text-xs text-[#a1a1aa] mt-0.5",
            },
          }}
        />
      </body>
    </html>
  );
}
