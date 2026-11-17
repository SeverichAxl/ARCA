import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        white: 'hsl(var(--white) / <alpha-value>)',
        /*
         * Familias heredadas del diseño original (violeta/lavanda).
         * Ahora apuntan a variables CSS para que el conmutador de tema
         * las convierta en azul oscuro (tema oscuro) o celeste (tema claro).
         */
        violet: {
          100: 'hsl(var(--violet-100) / <alpha-value>)',
          200: 'hsl(var(--violet-200) / <alpha-value>)',
          300: 'hsl(var(--violet-300) / <alpha-value>)',
          400: 'hsl(var(--violet-400) / <alpha-value>)',
          500: 'hsl(var(--violet-500) / <alpha-value>)',
          600: 'hsl(var(--violet-600) / <alpha-value>)',
        },
        fuchsia: {
          200: 'hsl(var(--fuchsia-200) / <alpha-value>)',
          400: 'hsl(var(--fuchsia-400) / <alpha-value>)',
          500: 'hsl(var(--fuchsia-500) / <alpha-value>)',
        },
        slate: {
          200: 'hsl(var(--slate-200) / <alpha-value>)',
          300: 'hsl(var(--slate-300) / <alpha-value>)',
          400: 'hsl(var(--slate-400) / <alpha-value>)',
          500: 'hsl(var(--slate-500) / <alpha-value>)',
          600: 'hsl(var(--slate-600) / <alpha-value>)',
        },
        emerald: {
          200: 'hsl(var(--emerald-200) / <alpha-value>)',
          300: 'hsl(var(--emerald-300) / <alpha-value>)',
          400: 'hsl(var(--emerald-400) / <alpha-value>)',
          500: 'hsl(var(--emerald-500) / <alpha-value>)',
        },
        amber: {
          200: 'hsl(var(--amber-200) / <alpha-value>)',
          300: 'hsl(var(--amber-300) / <alpha-value>)',
          400: 'hsl(var(--amber-400) / <alpha-value>)',
          500: 'hsl(var(--amber-500) / <alpha-value>)',
        },
        rose: {
          300: 'hsl(var(--rose-300) / <alpha-value>)',
          400: 'hsl(var(--rose-400) / <alpha-value>)',
        },
        red: {
          50: 'hsl(var(--red-50) / <alpha-value>)',
          200: 'hsl(var(--red-200) / <alpha-value>)',
          300: 'hsl(var(--red-300) / <alpha-value>)',
          400: 'hsl(var(--red-400) / <alpha-value>)',
          500: 'hsl(var(--red-500) / <alpha-value>)',
          600: 'hsl(var(--red-600) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
      },
      divideColor: {
        DEFAULT: 'hsl(var(--border))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'ui-sans-serif', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
