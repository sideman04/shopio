/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // Core neutrals — Shopio is black-on-white with warm beige.
        ink: {
          DEFAULT: '#111111',
          900: '#111111',
          800: '#1F1F1F',
          700: '#2E2E2E',
          600: '#4B4B4B',
          500: '#6B6B6B',
          400: '#8A8A8A',
          300: '#B4B4B4',
          200: '#D9D9D9',
          100: '#EDEDED',
          50: '#F7F7F7',
        },
        // Warm beige / sand — promotional sections.
        sand: {
          50: '#FBF8F4',
          100: '#F6EFE6',
          200: '#EFE3D4',
          300: '#E4D2BB',
          400: '#D7BE9E',
          500: '#C7A67F',
        },
        // Tasteful gold for star ratings / small accents.
        gold: {
          400: '#F2C14E',
          500: '#E8B02E',
          600: '#C8901A',
        },
        success: {
          50: '#ECFDF3',
          100: '#D1FADF',
          600: '#039855',
          700: '#027A48',
        },
        danger: {
          50: '#FEF3F2',
          100: '#FEE4E2',
          600: '#D92D20',
          700: '#B42318',
        },
        info: {
          50: '#EFF8FF',
          100: '#D1E9FF',
          600: '#1570EF',
          700: '#175CD3',
        },
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(17, 17, 17, 0.04), 0 1px 3px 0 rgba(17, 17, 17, 0.06)',
        lift: '0 10px 30px -12px rgba(17, 17, 17, 0.18)',
        header: '0 1px 0 0 rgba(17, 17, 17, 0.06)',
      },
      maxWidth: {
        container: '80rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
        'slide-in-right': 'slide-in-right 200ms ease-out',
        'slide-in-left': 'slide-in-left 200ms ease-out',
      },
    },
  },
  plugins: [],
}
