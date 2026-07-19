import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "LiquidityPilot — One-click V2 liquidity management",
  description: "Non-custodial swaps and one-click V2 liquidity management on Arbitrum.",
  icons: { icon: "/mark.svg" },
  openGraph: {
    title: "LiquidityPilot",
    description: "One-click V2 liquidity management on Arbitrum",
    images: [{ url: "/social-preview.png", width: 1200, height: 630, alt: "LiquidityPilot — liquidity, on course." }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/social-preview.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${geistSans.variable} ${geistMono.variable}`} lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
