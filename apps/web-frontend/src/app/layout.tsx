import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/components/auth/auth-provider';
import { MockBanner } from '@/components/shared/mock-banner';
import { ThemeProvider } from '@/components/theme/theme-provider';
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f0f9ff' },
    { media: '(prefers-color-scheme: dark)', color: '#070b14' },
  ],
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('arca-theme');var light=t==='light';var root=document.documentElement;root.classList.toggle('light',light);root.classList.toggle('dark',!light);root.dataset.theme=light?'light':'dark';root.style.colorScheme=light?'light':'dark';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasMockDomains = getActiveMockDomains().length > 0;

  return (
    <html
      lang="es"
      className={`dark ${inter.variable} ${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body
        className={`min-h-screen bg-background font-sans text-foreground ${
          hasMockDomains ? 'pb-8' : ''
        }`}
      >
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
        <MockBanner />
      </body>
    </html>
  );
}
