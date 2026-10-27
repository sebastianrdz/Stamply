import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { getLocale } from "@stamply/i18n/locale";
import { getDictionary } from "@stamply/i18n/dictionaries";
import { LocaleProvider } from "@stamply/i18n/provider";
import { Toaster } from "@stamply/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3001",
  ),
  title: {
    default: "Stamply — Digital loyalty cards",
    template: "%s · Stamply",
  },
  description:
    "Digital stamp, points, coupon and membership cards for cafés, gyms, salons, and shops — in Apple Wallet, Google Wallet, and the web.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LocaleProvider locale={locale} dict={dict}>
          {children}
        </LocaleProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
