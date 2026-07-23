import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mango: {
          950: '#1a1206',
          900: '#2b1d09',
          500: '#f5a623',
          300: '#ffd27a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
