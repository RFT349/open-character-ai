import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import config from "@/lib/config";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata = {
  title: "专属空间",
  description: "羊顺利的专属空间",
};


export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  const theme = config?.theme || "slate-indigo";

  return (
    <html lang="en" className={`h-full scroll-smooth ${inter.variable} ${outfit.variable}`} data-theme={theme}>
      <body
        className={`${inter.className} min-h-full flex flex-col antialiased bg-bg-page text-primary-text`}
      >
        <Providers>
          <main className="relative z-10 flex-1 flex flex-col">{children}</main>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
