import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Config do Vitest — testes de LÓGICA PURA (sem rede/DB/Next runtime).
 * - environment 'node': as funções cobertas não tocam DOM.
 * - alias '@' espelha o tsconfig (paths "@/*": ["./src/*"]) para imports futuros.
 * - include: descobre todo *.test.ts em src/ (corrige o teste antes órfão fora do script).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
