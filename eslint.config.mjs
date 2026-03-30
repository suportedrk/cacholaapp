import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    '.claude/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    'public/sw.js',
    'public/workbox-*.js',
    'public/swe-worker-*.js',
  ]),
  {
    rules: {
      // Enforce PT-BR friendly patterns
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // TypeScript
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // React
      'react/display-name': 'off',
    },
  },
])

export default eslintConfig
