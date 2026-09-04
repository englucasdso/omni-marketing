/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./frontend/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        heading: [
          'Bradesco Sans',
          'BradescoSans',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Arial',
          'Helvetica',
          'sans-serif'
        ],
        ui: [
          'Rethink Sans',
          'RethinkSans',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Arial',
          'Helvetica',
          'sans-serif'
        ],
        sans: [
          'Rethink Sans',
          'RethinkSans',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Arial',
          'Helvetica',
          'sans-serif'
        ],
      },
      colors: {
        'bradesco-red': '#cc092f',
        'bradesco-red-hover': '#b00728',
        'bradesco-purple': '#7d046d',
      },
      boxShadow: {
        'neu-card': '0 4px 16px -2px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'neu-card-hover': '0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 3px 6px -2px rgba(0, 0, 0, 0.04)',
        'neu-raised': '0 1px 3px rgba(0, 0, 0, 0.07), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'neu-raised-hover': '0 4px 10px rgba(0, 0, 0, 0.09), 0 1px 3px rgba(0, 0, 0, 0.05)',
        'neu-pressed': 'inset 0 2px 4px rgba(0, 0, 0, 0.08), inset 0 1px 2px rgba(0, 0, 0, 0.06)',
        'neu-input': 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        'neu': '16px',
        'neu-lg': '20px',
      }
    },
  },
  plugins: [],
}
