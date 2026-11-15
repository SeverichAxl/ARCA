import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/components/auth/auth-provider';
import { MockBanner } from '@/components/shared/mock-banner';
import { getActiveMockDomains } from '@/lib/api/mock-status';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ARCA | Gestión Humana',
    template: '%s | ARCA',
  },
  description: 'Sistema de Gestión Humana de ARCA Ltda.',
};

export const viewport: Viewport = {
  themeColor: '#0b0714',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasMockDomains = getActiveMockDomains().length > 0;

  return (
    <html lang="es" className={`${inter.variable} ${display.variable} ${mono.variable}`}>
      <body
        className={`min-h-screen bg-background font-sans text-foreground ${
          hasMockDomains ? 'pb-8' : ''
        }`}
      >
        <AuthProvider>{children}</AuthProvider>
        <MockBanner />
      </body>
    </html>
  );
}
