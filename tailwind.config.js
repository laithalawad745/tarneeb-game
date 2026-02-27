/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        felt: '#1a5c2e',
        'felt-dark': '#0f3d1e',
        gold: '#d4a843',
        'gold-dark': '#b8912a',
      },
      fontFamily: {
        game: ['Cairo', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
