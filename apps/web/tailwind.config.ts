import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef7f4',
          100: '#d5ebe3',
          200: '#aad7c7',
          300: '#78bca6',
          400: '#4d9d86',
          500: '#34816d',
          600: '#276756',
          700: '#215346',
          800: '#1d433a',
          900: '#193831',
        },
        ink: {
          50: '#f6f7f8',
          100: '#eceef1',
          200: '#d5dae1',
          300: '#b0b9c6',
          400: '#8592a5',
          500: '#667589',
          600: '#515e70',
          700: '#434c5b',
          800: '#3a424e',
          900: '#343a44',
          950: '#22262d',
        },
      },
      boxShadow: {
        panel: '0 10px 40px rgba(34, 38, 45, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
