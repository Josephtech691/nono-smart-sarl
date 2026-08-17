/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pine: {
          950: '#0A2A1D',
          900: '#0F3D2C',
          800: '#155039',
          700: '#1D6B4C',
          600: '#237F59',
        },
        brand: {
          500: '#33B56C',
          600: '#279C5A',
          700: '#1E7D47',
        },
        ink: '#121814',
        paper: '#FAFAF7',
        mist: '#F0F3F0',
        line: '#E1E6E0',
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 61, 44, 0.06), 0 8px 24px -12px rgba(15, 61, 44, 0.18)',
      },
    },
  },
  plugins: [],
};
