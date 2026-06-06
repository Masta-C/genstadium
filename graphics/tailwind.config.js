import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const tokens = require('../docs/design-tokens.json')

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: tokens.color.background.base.value,
          surface: tokens.color.background.surface.value,
          raised: tokens.color.background.raised.value,
          overlay: tokens.color.background.overlay.value,
        },
        brand: {
          primary: tokens.color.brand.primary.value,
          'primary-dim': tokens.color.brand.primaryDim.value,
        },
        semantic: {
          live: tokens.color.semantic.live.value,
          warning: tokens.color.semantic.warning.value,
          danger: tokens.color.semantic.danger.value,
        },
        text: {
          primary: tokens.color.text.primary.value,
          secondary: tokens.color.text.secondary.value,
          disabled: tokens.color.text.disabled.value,
        },
      },
      spacing: {
        xs: `${tokens.spacing.scale.xs.value}px`,
        sm: `${tokens.spacing.scale.sm.value}px`,
        md: `${tokens.spacing.scale.md.value}px`,
        lg: `${tokens.spacing.scale.lg.value}px`,
        xl: `${tokens.spacing.scale.xl.value}px`,
        '2xl': `${tokens.spacing.scale['2xl'].value}px`,
      },
      borderRadius: {
        sm: `${tokens.radius.sm.value}px`,
        md: `${tokens.radius.md.value}px`,
        lg: `${tokens.radius.lg.value}px`,
        xl: `${tokens.radius.xl.value}px`,
      },
      fontFamily: {
        sans: [tokens.typography.fontFamily.primary.value, 'sans-serif'],
        mono: [tokens.typography.fontFamily.mono.value, 'monospace'],
      },
    },
  },
  plugins: [],
}
