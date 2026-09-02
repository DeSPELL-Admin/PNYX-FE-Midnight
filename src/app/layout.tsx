import type { Metadata } from 'next';
import { GoogleAnalytics } from '@next/third-parties/google';

import localFont from 'next/font/local';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import '~/app/globals.css';
import { Providers } from '~/app/providers';
import { APP_NAME, APP_DESCRIPTION } from '~/lib/constants';
import Container from '~/components/ui/Container';
import Header from '~/components/layout/Header';
import BottomNavbar from '~/components/layout/BottomNavbar';
import MainWrapper from '~/components/layout/MainWrapper';
import { Toaster } from '~/components/ui/toaster';
import { HTML_LANG, type Locale } from '~/../i18n/config';

const albert = localFont({
  src: '../../public/fonts/AlbertSans-SemiBold.ttf',
  variable: '--font-albert',
  display: 'swap',
});

const pretendard = localFont({
  src: '../../public/fonts/Pretendard-Regular.otf',
  variable: '--font-pretendard',
  display: 'swap',
});

const roboto = localFont({
  src: '../../public/fonts/Roboto-MediumItalic.ttf',
  variable: '--font-roboto',
  display: 'swap',
})

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  icons: {
    icon: '/icon.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();

  return (
    <html lang={HTML_LANG[locale] ?? 'en'} translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body suppressHydrationWarning className={`${albert.variable} ${pretendard.variable}`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <div className="bg-primary min-h-screen flex justify-center font-sans text-white">
              <Container>
                <Header />
                <MainWrapper>
                  {children}
                </MainWrapper>
                <BottomNavbar />
                <Toaster />
              </Container>
            </div>
          </Providers>
        </NextIntlClientProvider>
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}
