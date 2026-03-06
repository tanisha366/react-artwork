/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,jsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: '400px',
      },
    },
  },
  plugins: [],
}