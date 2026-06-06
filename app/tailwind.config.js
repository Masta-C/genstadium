/** @type {import('tailwindcss').Config} */
const tokens = require('../docs/design-tokens.json')

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
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
          'primary-glow': tokens.color.brand.primaryGlow.value,
        },
        semantic: {
          live: tokens.color.semantic.live.value,
          warning: tokens.color.semantic.warning.value,
          danger: tokens.color.semantic.danger.value,
          offline: tokens.color.semantic.offline.value,
          info: tokens.color.semantic.info.value,
        },
        score: {
          positive: tokens.color.score.positive.value,
          negative: tokens.color.score.negative.value,
          neutral: tokens.color.score.neutral.value,
        },
        text: {
          primary: tokens.color.text.primary.value,
          secondary: tokens.color.text.secondary.value,
          disabled: tokens.color.text.disabled.value,
          inverse: tokens.color.text.inverse.value,
        },
        border: {
          subtle: tokens.color.border.subtle.value,
          moderate: tokens.color.border.moderate.value,
          strong: tokens.color.border.strong.value,
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
        full: `${tokens.radius.full.value}px`,
      },
      fontFamily: {
        sans: [tokens.typography.fontFamily.primary.value, tokens.typography.fontFamily.primary.fallback],
        mono: [tokens.typography.fontFamily.mono.value],
      },
    },
  },
  plugins: [],
}
