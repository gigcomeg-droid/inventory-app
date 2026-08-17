/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          50: '#19058c',
          100: '#ffffff',
          900: '#1d0c5f',
          950: '#1f0f4d',
        },
        brand: {
          50: '#d28c64',
          100: '#d28c64',
          200: '#d28c64',
          300: '#d28c64',
          400: '#d28c64',
          500: '#d28c64',
          600: '#d28c64',
          700: '#d28c64',
          800: '#d28c64',
          900: '#d28c64	',
        },
        accent: {
          teal: '#12d8b8',
          purple: '#8b5cf6',
          amber: '#f5a524',
          rose: '#fb3d6a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(59,91,253,0.15), 0 8px 30px rgba(59,91,253,0.12)',
        card: '0 1px 2px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.06)',
      },
      backgroundImage: {
        'grid-glow':
          'radial-gradient(circle at 20% 20%, rgba(59,91,253,0.15), transparent 40%), radial-gradient(circle at 80% 0%, rgba(139,92,246,0.12), transparent 40%)',
      },
    },
  },
  plugins: [],
};
