/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // 共用元件（週看板、特殊活動、登入頁）的 class 也要產生，否則畫面會缺樣式
    "../../packages/shared/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans TC', 'system-ui', '-apple-system', 'PingFang TC', 'Microsoft JhengHei', 'sans-serif'],
      },
      screens: {
        'xs': '480px',
      },
      colors: {
        // 暖色淺色設計系統 — 對應 docs/前後台拆分與使用者端PWA重構-設計報告.md §4.4
        bg: '#FAF8F5',
        surface: {
          DEFAULT: '#FFFFFF',
          sunken: '#F1ECE4',
        },
        border: {
          DEFAULT: '#E5DED3',
        },
        ink: {
          DEFAULT: '#1F1D1B',
          soft: '#5B5750',
          faint: '#8A857C',
        },
        primary: {
          DEFAULT: '#3A4E8C',
          ink: '#FFFFFF',
          soft: '#EAEEF7',
          hover: '#324379',
        },
        accent: {
          DEFAULT: '#E0982F',
          soft: 'rgba(224,152,47,0.14)',
        },
        success: { DEFAULT: '#2E7D53', soft: 'rgba(46,125,83,0.12)' },
        warning: { DEFAULT: '#A96A16', soft: 'rgba(169,106,22,0.12)' },
        danger:  { DEFAULT: '#B4302B', soft: 'rgba(180,48,43,0.12)' },
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
        'sheet-up': {
          '0%':   { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up':   'fade-up 0.35s ease-out both',
        'fade-in':   'fade-in 0.25s ease-out both',
        'scale-in':  'scale-in 0.25s ease-out both',
        'shimmer':   'shimmer 2.5s linear infinite',
        'sheet-up':  'sheet-up 0.28s cubic-bezier(.2,.8,.2,1) both',
      },
      boxShadow: {
        'card':       '0 1px 2px rgba(31,29,27,.06), 0 1px 1px rgba(31,29,27,.04)',
        'card-hover': '0 4px 16px rgba(31,29,27,.08)',
        'sheet':      '0 -8px 40px rgba(31,29,27,.16)',
        'modal':      '0 8px 32px rgba(31,29,27,.14)',
      },
    },
  },
  plugins: [],
}
