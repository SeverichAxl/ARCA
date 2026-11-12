import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/components/auth/auth-provider';
import { MockBanner } from '@/components/shared/mock-banner';
import { getActiveMockDomains } from '@/lib/api/mock-status';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ARCA | Gestión Humana',
    template: '%s | ARCA',
  },
  description: 'Sistema de Gestión Humana de ARCA Ltda.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasMockDomains = getActiveMockDomains().length > 0;

  return (
    <html lang="es" className={inter.variable}>
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
