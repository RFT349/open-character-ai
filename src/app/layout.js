import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Open Character AI - Futuristic Persona Chat Portal",
  description: "Open-source Character.AI alternative — chat with high-fidelity pre-defined or custom-created AI personas, with per-chat LLM tuning, powered by Next.js, Prisma, and Supabase.",
};

import { Providers } from "@/components/Providers";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col antialiased cyber-bg text-gray-100`}
      >
        <div className="fixed inset-0 cyber-grid pointer-events-none z-0" />
        <Providers>
          <main className="relative z-10 flex-1 flex flex-col">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
