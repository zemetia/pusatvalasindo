import type { Metadata, Viewport } from "next";
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

/**
 * Default aman: semua yang TIDAK menetapkan metadata sendiri (dashboard, login, /old, harness
 * internal) tidak diindeks. Halaman publik memakai buildMetadata() (src/lib/seo.ts), yang
 * menimpa `robots` menjadi index/follow.
 */
export const metadata: Metadata = {
  title: "Pusat Valas Indo",
  robots: { index: false, follow: false },
  applicationName: "Pusat Valas Indo",
  ...(process.env["NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"]
    ? { verification: { google: process.env["NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"] } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: "#c62828",
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
