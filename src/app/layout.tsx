import { ReactNode } from 'react';
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
import Script from "next/script";
import { FcmRegistrar } from "@/components/fcm-registrar";
import { ThemeProvider } from 'next-themes';

export const metadata = {
  title: "HotSell",
  description: "A secondhand marketplace app.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6189242189989239"
          crossOrigin="anonymous"
        ></script>
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
          <Providers>
            <FcmRegistrar />
            {children}
            <Toaster />
          </Providers>
      </body>
    </html>
  );
}
