/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0a1c2b',
          800: '#12293d',
          700: '#1a3650',
          600: '#244466',
        },
        chart: {
          paper: '#e7dfc6',
          land: '#c7bb96',
          line: '#8a7a55',
        },
        safe: { DEFAULT: '#1fa37a', dim: 'rgba(31,163,122,0.16)' },
        caution: { DEFAULT: '#e0a83e', dim: 'rgba(224,168,62,0.16)' },
        alert: { DEFAULT: '#e8542b', dim: 'rgba(232,84,43,0.18)' },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        display: ['Bebas Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
