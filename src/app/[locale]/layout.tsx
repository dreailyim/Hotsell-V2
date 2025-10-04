import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ReactNode } from "react";
import { Providers } from "@/app/providers";
import { Toaster } from "@/components/ui/toaster";
import "@/app/globals.css";
import Script from "next/script";
import { FcmRegistrar } from "@/components/fcm-registrar";
import { I18nProviderClient } from "@/i18n/client";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "HotSell",
  description: "A secondhand marketplace app.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
  params: { locale },
}: Readonly<{
  children: ReactNode;
  params: { locale: string };
}>) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6189242189989239"
          crossOrigin="anonymous"
        ></script>
      </head>
      <body className={`${inter.variable} font-body antialiased`} suppressHydrationWarning>
        <I18nProviderClient locale={locale}>
          <Providers>
            <FcmRegistrar />
            {children}
            <Toaster />
          </Providers>
        </I18nProviderClient>
      </body>
    </html>
  );
}
