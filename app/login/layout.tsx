import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — Badazz Tasks",
  description: "Sign in to Badazz Tasks",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}