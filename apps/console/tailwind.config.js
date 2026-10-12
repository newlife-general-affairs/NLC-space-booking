/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      screens: {
        'xs': '480px',
      },
      colors: {
        // 60-30-10：深海軍藍基底、藍灰表面、琥珀金重點。
        surface: {
          DEFAULT: '#07111f',
          raised: '#10233d',
          overlay: '#18314f',
          border: 'rgba(203,213,225,0.22)',
        },
        brand: {
          DEFAULT: '#f0b44d',
          soft:    'rgba(240,180,77,0.16)',
          muted:   'rgba(240,180,77,0.08)',
        },
        // 現有介面使用 indigo / violet 作為品牌色；在設計系統層統一映射，
        // 避免各頁出現互相競爭的強調色。
        indigo: {
          50: '#fff8e6', 100: '#fdecc8', 200: '#f9d58d', 300: '#f4c166',
          400: '#f0b44d', 500: '#a8620a', 600: '#8a4b08', 700: '#6d3906',
          800: '#542b07', 900: '#3f2107', 950: '#281503',
        },
        violet: {
          50: '#fff8e6', 100: '#fdecc8', 200: '#f9d58d', 300: '#f4c166',
          400: '#f0b44d', 500: '#a8620a', 600: '#8a4b08', 700: '#6d3906',
          800: '#542b07', 900: '#3f2107', 950: '#281503',
        },
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up':   'fade-up 0.35s ease-out both',
        'fade-in':   'fade-in 0.25s ease-out both',
        'scale-in':  'scale-in 0.25s ease-out both',
        'shimmer':   'shimmer 2.5s linear infinite',
      },
      boxShadow: {
        'glow-sm':  '0 0 12px rgba(240,180,77,0.22)',
        'glow':     '0 0 24px rgba(240,180,77,0.28)',
        'glow-lg':  '0 0 40px rgba(240,180,77,0.18)',
        'card':     '0 1px 3px rgba(0,0,0,0.4), 0 1px 1px rgba(0,0,0,0.3)',
        'card-hover':'0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)',
        'modal':    '0 8px 32px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
