import type { Metadata } from "next";
import { Providers } from "../providers";
import { Toaster } from "@/components/ui/toaster";
import "../globals.css";
import Script from "next/script";
import { FcmRegistrar } from "@/components/fcm-registrar";
import { I18nProvider } from '../../i18n/client';

export const metadata: Metadata = {
  title: "HotSell",
  description: "A secondhand marketplace app.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
  params: { locale }
}: Readonly<{
  children: React.ReactNode;
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
      <body className="font-body antialiased" suppressHydrationWarning>
        <I18nProvider locale={locale}>
          <Providers>
            <FcmRegistrar />
            {children}
            <Toaster />
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}