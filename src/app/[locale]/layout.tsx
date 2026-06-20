import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Inter, Outfit } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@src/i18n/routing';
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/providers/QueryProvider";
import "../globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Home - Authorized Money Changer in Jakarta | Pusat Valas Indo",
  description: "Authorized Money Changer in Jakarta. Dapatkan layanan penukaran valuta asing dan pengiriman uang ke luar negeri dengan kurs kompetitif dan transaksi aman di Jakarta. Bersertifikat Bank Indonesia (Izin 20/28/KEP.GBI/DKSP/2018).",
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${outfit.variable} antialiased grain`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem={false}
            >
              {children}
              <Toaster position="bottom-right" richColors />
            </ThemeProvider>
          </QueryProvider>
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
