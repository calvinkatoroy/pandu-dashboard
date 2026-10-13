/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0f1317',
          800: '#161b21',
          700: '#1e252d',
          600: '#2a333d',
        },
        chart: {
          paper: '#e7dfc6',
          land: '#c7bb96',
          line: '#8a7a55',
        },
        safe: { DEFAULT: '#79b99c', dim: 'rgba(121,185,156,0.16)' },
        caution: { DEFAULT: '#e6b04b', dim: 'rgba(230,176,75,0.16)' },
        alert: { DEFAULT: '#f2694a', dim: 'rgba(242,105,74,0.18)' },
      },
      fontFamily: {
        sans: ['Public Sans', 'system-ui', 'sans-serif'],
        mono: ['Public Sans', 'system-ui', 'sans-serif'],
        display: ['Public Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
