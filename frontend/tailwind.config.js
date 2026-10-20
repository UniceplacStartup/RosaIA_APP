/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      colors: {
        // Paleta oficial RosaIA — idêntica ao protótipo original
        rosa: {
          900: '#5A0E2D',
          800: '#8E1948',
          700: '#A82459',
          600: '#C24B72',
          500: '#E0356F',
          300: '#D998B5',
          200: '#F5CEDD',
          100: '#F8D7E3',
          50: '#FBE1EA',
        },
      },
    },
  },
  plugins: [],
};
