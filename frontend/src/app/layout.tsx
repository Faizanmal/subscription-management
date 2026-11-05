import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { publicIndexing, siteUrl } from '@/lib/site';

const inter = localFont({
  src: "./fonts/InterVariable.ttf",
  display: "swap",
  weight: "100 900",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: "Subscription Waste Manager | Reduce SaaS Waste",
  description: "Detect, analyze, and reduce money wasted on unused or duplicate software subscriptions. AI-powered optimization for your SaaS stack.",
  keywords: ["SaaS management", "subscription optimization", "cost reduction", "software waste"],
  robots: publicIndexing ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: {
    type: 'website',
    siteName: 'Subscription Waste Manager',
    title: 'Find and cut wasted software subscriptions',
    description: 'Track software spend, review usage, and plan your next savings opportunity.',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
