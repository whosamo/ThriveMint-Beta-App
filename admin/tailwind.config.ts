import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#2ECC71',
        'brand-dark': '#27AE60',
      },
    },
  },
  plugins: [],
};

export default config;
