import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Night orchard: the ground everything sits on.
        orchard: {
          950: '#080b09',
          900: '#111a12',
          800: '#18251a',
        },
        // Ripe fruit: primary accent and interface chrome.
        mango: {
          950: '#1a1206',
          900: '#2b1d09',
          700: '#7a4f12',
          500: '#f5a623',
          300: '#ffd27a',
          100: '#ffeccb',
        },
        // Healthy growth: nominal state, containment, prevention guidance.
        leaf: {
          500: '#4a9d5f',
          300: '#8fd4a0',
        },
        // Blight: confirmed compromise.
        blight: {
          600: '#c2372b',
          400: '#e86a5c',
        },
      },
      fontFamily: {
        display: ['"Segoe UI"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"Cascadia Code"', '"JetBrains Mono"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
